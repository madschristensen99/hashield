// SPDX-License-Identifier: LGPLv3
pragma solidity ^0.8.19;

import {SwapCreator} from "./atomic-swap/ethereum/contracts/SwapCreator.sol";
import {IEscrowSrc} from "./cross-chain-swap/contracts/interfaces/IEscrowSrc.sol";
import {IEscrow} from "./cross-chain-swap/contracts/interfaces/IEscrow.sol";
import {IBaseEscrow} from "./cross-chain-swap/contracts/interfaces/IBaseEscrow.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SwapCreatorAdapter is IEscrowSrc {
    SwapCreator public immutable SC;
    
    // Mapping from 1inch orderHash to SwapCreator swapID
    mapping(bytes32 => bytes32) public orderToSwapID;
    
    // Mapping from swapID to swap parameters
    mapping(bytes32 => SwapParams) public swapParams;
    
    // Store essential swap parameters to reconstruct the Swap struct
    struct SwapParams {
        address payable owner;
        bytes32 claimCommitment;
        bytes32 refundCommitment;
        uint256 timeout1;
        uint256 timeout2;
        address asset;  // Address of token (address(0) for ETH)
        uint256 value;
        uint256 nonce;
    }
    
    // Events
    event SwapCreated(bytes32 orderHash, bytes32 swapID);
    event WithdrawExecuted(bytes32 orderHash, bytes32 swapID, address recipient);
    event CancelExecuted(bytes32 orderHash, bytes32 swapID);
    
    constructor(SwapCreator _sc) { SC = _sc; }

    /* --------------------------------------------------------
       1.  IEscrowSrc – main functions called by 1inch
       -------------------------------------------------------- */
    function createEscrow(
        bytes32 orderHash,
        address token,uint256 amount,address,address,
        uint48,uint48,bytes calldata extraData
    ) external payable {
        (bytes32 claimC, bytes32 refundC, uint256 nonce) = abi.decode(extraData, (bytes32, bytes32, uint256));
        
        // Determine if this is an ETH or token swap
        address asset = address(0);  // Default to ETH
        uint256 value = msg.value;   // Default to msg.value for ETH
        
        // If token is specified, use it instead of ETH
        if (token != address(0)) {
            asset = token;
            value = amount;
            
            // Transfer tokens from sender to this contract
            IERC20(token).transferFrom(msg.sender, address(this), amount);
            
            // Approve SwapCreator to spend these tokens
            IERC20(token).approve(address(SC), amount);
        }
        
        // Create the swap using SwapCreator
        bytes32 swapID = SC.newSwap{value: msg.value}(
            claimC,
            refundC,
            payable(address(this)), // adapter is the claimer
            1 days, // timeout1 duration (24 hours)
            7 days, // timeout2 duration (7 days)
            asset,  // ETH or token address
            value,  // ETH or token amount
            nonce
        );
        
        // Store the swap parameters
        swapParams[swapID] = SwapParams({
            owner: payable(msg.sender),
            claimCommitment: claimC,
            refundCommitment: refundC,
            timeout1: block.timestamp + 1 days,
            timeout2: block.timestamp + 1 days + 7 days,
            asset: asset,
            value: value,
            nonce: nonce
        });
        
        // Store the mapping from orderHash to swapID
        orderToSwapID[orderHash] = swapID;
        
        emit SwapCreated(orderHash, swapID);
    }

    function predictEscrowAddress(
        bytes32,address,uint256,address,address,uint48,uint48,bytes calldata
    ) external view returns (address) { return address(SC); }

    /* --------------------------------------------------------
       2.  Implement withdraw functions
       -------------------------------------------------------- */
    function withdraw(bytes32 secret, IBaseEscrow.Immutables calldata immutables) external {
        _withdrawInternal(secret, immutables.orderHash, msg.sender);
    }
    
    function withdrawTo(bytes32 secret, address recipient, IEscrow.Immutables calldata immutables) external {
        _withdrawInternal(secret, immutables.orderHash, recipient);
    }
    
    function publicWithdraw(bytes32 secret, IBaseEscrow.Immutables calldata immutables) external {
        _withdrawInternal(secret, immutables.orderHash, msg.sender);
    }
    
    function _withdrawInternal(bytes32 secret, bytes32 orderHash, address recipient) internal {
        // Get the swapID from orderHash
        bytes32 swapID = orderToSwapID[orderHash];
        require(swapID != bytes32(0), "Unknown order");
        
        // Get the current stage and check if the swap is claimable
        SwapCreator.Stage stage = SC.swaps(swapID);
        
        // Ensure the swap is in READY state or still PENDING
        require(stage == SwapCreator.Stage.READY || stage == SwapCreator.Stage.PENDING, "Swap not claimable");
        
        // If PENDING, set it to READY first
        if (stage == SwapCreator.Stage.PENDING) {
            // We need to be the owner to set ready, which we're not
            // This is a limitation of the current design
            revert("Swap not ready - owner must call setReady");
        }
        
        // Reconstruct the Swap struct
        SwapCreator.Swap memory swap = _getSwapStruct(swapID);
        
        // We'll use the regular claim method since we are the claimer in the SwapCreator contract
        
        // Track balances before claiming
        uint256 ethBalanceBefore = address(this).balance;
        uint256 tokenBalanceBefore = 0;
        
        // If this is a token swap, get the token balance before claiming
        if (swap.asset != address(0)) {
            tokenBalanceBefore = IERC20(swap.asset).balanceOf(address(this));
        }
        
        // Call claim directly since we are the claimer
        SC.claim(swap, secret);
        
        // Handle the received assets based on asset type
        if (swap.asset == address(0)) {
            // ETH swap - calculate how much we received
            uint256 received = address(this).balance - ethBalanceBefore;
            
            // Forward the ETH to the recipient
            if (received > 0) {
                (bool success, ) = recipient.call{value: received}("");
                require(success, "ETH transfer failed");
            }
        } else {
            // Token swap - calculate how many tokens we received
            uint256 received = IERC20(swap.asset).balanceOf(address(this)) - tokenBalanceBefore;
            
            // Forward the tokens to the recipient
            if (received > 0) {
                IERC20(swap.asset).transfer(recipient, received);
            }
        }
        
        emit WithdrawExecuted(orderHash, swapID, recipient);
    }

    /* --------------------------------------------------------
       3.  Implement cancel and rescue functions
       -------------------------------------------------------- */
    function cancel(IBaseEscrow.Immutables calldata immutables) external view {
        _cancelInternal(immutables.orderHash, msg.sender);
    }
    
    function publicCancel(IBaseEscrow.Immutables calldata immutables) external view {
        _cancelInternal(immutables.orderHash, msg.sender);
    }
    
    function _cancelInternal(bytes32 orderHash, address caller) internal view {
        // Get the swapID from orderHash
        bytes32 swapID = orderToSwapID[orderHash];
        require(swapID != bytes32(0), "Unknown order");
        
        // Get the current stage
        SwapCreator.Stage stage = SC.swaps(swapID);
        
        // Ensure the swap is not already completed
        require(stage != SwapCreator.Stage.COMPLETED, "Swap already completed");
        
        // Reconstruct the Swap struct
        SwapCreator.Swap memory swap = _getSwapStruct(swapID);
        
        // Only the owner can refund
        require(swap.owner == caller, "Only owner can cancel");
        
        // For refund, we need the refund secret
        // In a real implementation, the owner would need to provide this
        revert("To cancel, call refundWithSecret");
    }
    
    // Function to refund with the refund secret
    function refundWithSecret(bytes32 orderHash, bytes32 refundSecret) external {
        // Get the swapID from orderHash
        bytes32 swapID = orderToSwapID[orderHash];
        require(swapID != bytes32(0), "Unknown order");
        
        // Reconstruct the Swap struct
        SwapCreator.Swap memory swap = _getSwapStruct(swapID);
        
        // Only the owner can refund
        require(swap.owner == msg.sender, "Only owner can refund");
        
        // Call refund with the provided refund secret
        SC.refund(swap, refundSecret);
        
        emit CancelExecuted(orderHash, swapID);
    }
    
    function rescueFunds(address, uint256, IBaseEscrow.Immutables calldata) external pure {
        // This would be used for emergency fund recovery
        // Not directly supported by SwapCreator, so we revert
        revert("Use refundWithSecret instead");
    }
    
    /* --------------------------------------------------------
       4.  Helper functions
       -------------------------------------------------------- */
    // Function to manually set a swap to READY state
    function setSwapReady(bytes32 orderHash) external {
        // Get the swapID from orderHash
        bytes32 swapID = orderToSwapID[orderHash];
        require(swapID != bytes32(0), "Unknown order");
        
        // Reconstruct the Swap struct
        SwapCreator.Swap memory swap = _getSwapStruct(swapID);
        
        // Only the owner can set ready
        require(swap.owner == msg.sender, "Only owner can set ready");
        
        // Call setReady on the SwapCreator
        SC.setReady(swap);
    }
    
    // Helper function to reconstruct the Swap struct from stored parameters
    function _getSwapStruct(bytes32 swapID) internal view returns (SwapCreator.Swap memory) {
        SwapParams memory params = swapParams[swapID];
        require(params.owner != address(0), "Swap not found");
        
        return SwapCreator.Swap({
            owner: params.owner,
            claimer: payable(address(this)),
            claimCommitment: params.claimCommitment,
            refundCommitment: params.refundCommitment,
            timeout1: params.timeout1,
            timeout2: params.timeout2,
            asset: params.asset, // ETH or token address
            value: params.value,
            nonce: params.nonce
        });
    }

    /* --------------------------------------------------------
       5.  Constants and fallback functions
       -------------------------------------------------------- */
    function PROXY_BYTECODE_HASH() external pure returns (bytes32) { return bytes32(0); }
    function RESCUE_DELAY() external pure returns (uint256) { return 0; }
    function FACTORY() external view returns (address) { return address(this); }
}
