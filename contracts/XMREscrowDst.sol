// SPDX-License-Identifier: LGPLv3
pragma solidity ^0.8.19;

import {SwapCreator} from "./atomic-swap/ethereum/contracts/SwapCreator.sol";
import {IEscrowDst} from "./cross-chain-swap/contracts/interfaces/IEscrowDst.sol";
import {IEscrow} from "./cross-chain-swap/contracts/interfaces/IEscrow.sol";
import {IBaseEscrow} from "./cross-chain-swap/contracts/interfaces/IBaseEscrow.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title Destination Escrow adapter for SwapCreator
 * @notice This contract adapts the SwapCreator contract to work with the 1inch cross-chain swap protocol
 * @dev Implements the IEscrowDst interface to provide destination functionality for cross-chain swaps
 */
contract XMREscrowDst is IEscrowDst {
    using SafeERC20 for IERC20;
    
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
       1.  IEscrowDst – main functions called by 1inch
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
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
            
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
            asset,
            value,
            nonce
        );
        
        // Store the mapping from orderHash to swapID
        orderToSwapID[orderHash] = swapID;
        
        // Store the swap parameters for later use
        swapParams[swapID] = SwapParams({
            owner: payable(msg.sender),
            claimCommitment: claimC,
            refundCommitment: refundC,
            timeout1: block.timestamp + 1 days,
            timeout2: block.timestamp + 7 days,
            asset: asset,
            value: value,
            nonce: nonce
        });
        
        emit SwapCreated(orderHash, swapID);
    }
    
    function predictEscrowAddress(
        bytes32,address,uint256,address,address,uint48,uint48,bytes calldata
    ) external view returns (address) { return address(SC); }

    /* --------------------------------------------------------
       2.  Implement withdraw functions
       -------------------------------------------------------- */
    // Standard withdraw function from IBaseEscrow
    function withdraw(bytes32 secret, IBaseEscrow.Immutables calldata immutables) external {
        _withdrawInternal(immutables.orderHash, secret, payable(msg.sender));
    }
    
    // PublicWithdraw function from IEscrowDst
    // This allows anyone to withdraw after the second timeout period
    function publicWithdraw(bytes32 secret, IBaseEscrow.Immutables calldata immutables) external {
        bytes32 orderHash = immutables.orderHash;
        bytes32 swapID = orderToSwapID[orderHash];
        require(swapID != bytes32(0), "Swap not found");
        
        // Get the swap parameters
        SwapParams memory params = swapParams[swapID];
        
        // For public withdrawal, we need to be past the first timeout
        require(block.timestamp > params.timeout1, "Public withdrawal period not reached");
        
        // Convert the Address type to address by using the raw bytes20 value
        address makerAddress = address(uint160(bytes20(abi.encodePacked(immutables.maker))));
        
        // Anyone can trigger the withdrawal, but funds go to the maker
        _withdrawInternal(orderHash, secret, payable(makerAddress));
    }
    
    // Internal function to handle withdrawals
    function _withdrawInternal(bytes32 orderHash, bytes32 secret, address payable recipient) internal {
        bytes32 swapID = orderToSwapID[orderHash];
        require(swapID != bytes32(0), "Swap not found");
        
        // Reconstruct the Swap struct
        SwapCreator.Swap memory swap = _getSwapStruct(swapID);
        
        // Call claim on SwapCreator
        SC.claim(swap, secret);
        
        // Transfer the funds to the recipient
        if (swap.asset == address(0)) {
            // ETH transfer
            recipient.transfer(swap.value);
        } else {
            // ERC20 transfer
            IERC20(swap.asset).safeTransfer(recipient, swap.value);
        }
        
        emit EscrowWithdrawal(secret);
    }

    /* --------------------------------------------------------
       3.  Implement cancel functions
       -------------------------------------------------------- */
    function cancel(IBaseEscrow.Immutables calldata immutables) external {
        _cancelInternal(immutables.orderHash, msg.sender, bytes32(0));
    }
    
    // Internal function to handle cancellations
    function _cancelInternal(bytes32 orderHash, address caller, bytes32 refundSecret) internal {
        bytes32 swapID = orderToSwapID[orderHash];
        require(swapID != bytes32(0), "Swap not found");
        
        // Get the swap parameters
        SwapParams memory params = swapParams[swapID];
        
        // Only the owner can cancel
        require(params.owner == caller, "Only owner can cancel");
        
        // Reconstruct the Swap struct
        SwapCreator.Swap memory swap = _getSwapStruct(swapID);
        
        // Call refund on SwapCreator
        SC.refund(swap, refundSecret);
        
        emit EscrowCancelled();
    }
    
    // Helper function to reconstruct the Swap struct
    function _getSwapStruct(bytes32 swapID) internal view returns (SwapCreator.Swap memory) {
        SwapParams memory params = swapParams[swapID];
        return SwapCreator.Swap({
            owner: params.owner,
            claimer: payable(address(this)),
            claimCommitment: params.claimCommitment,
            refundCommitment: params.refundCommitment,
            timeout1: params.timeout1,
            timeout2: params.timeout2,
            asset: params.asset,
            value: params.value,
            nonce: params.nonce
        });
    }

    /* --------------------------------------------------------
       4.  Implement required interface functions
       -------------------------------------------------------- */
    function PROXY_BYTECODE_HASH() external pure returns (bytes32) {
        // This is a placeholder hash - in a real implementation, this would be the hash of the proxy bytecode
        return bytes32(uint256(0x123456789));
    }
    
    function RESCUE_DELAY() external pure returns (uint256) {
        // In our implementation, rescue delay is 0
        return 0;
    }
    
    function FACTORY() external pure returns (address) {
        // This would be the factory address in a real implementation
        return address(0);
    }
    
    // Implement rescueFunds as required by IBaseEscrow
    function rescueFunds(address token, uint256 amount, IBaseEscrow.Immutables calldata immutables) external {
        bytes32 orderHash = immutables.orderHash;
        bytes32 swapID = orderToSwapID[orderHash];
        require(swapID != bytes32(0), "Swap not found");
        
        SwapParams memory params = swapParams[swapID];
        
        // Only the maker can rescue funds
        // Convert the Address type to address by using the raw bytes20 value
        address makerAddress = address(uint160(bytes20(abi.encodePacked(immutables.maker))));
        require(makerAddress == msg.sender, "Only maker can rescue funds");
        
        // Ensure the timeout has passed (RESCUE_DELAY is 0 in our implementation)
        require(block.timestamp > params.timeout2, "Timeout not reached");
        
        // Use the provided token and amount parameters
        // This allows rescuing specific tokens that might be stuck in the contract
        if (token == address(0)) {
            // ETH transfer
            payable(makerAddress).transfer(amount);
        } else {
            // ERC20 transfer
            IERC20(token).safeTransfer(makerAddress, amount);
        }
        
        // Emit the required event
        emit FundsRescued(token, amount);
    }
}
