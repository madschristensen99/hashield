// SPDX-License-Identifier: LGPLv3
pragma solidity ^0.8.19;

import {SwapCreator} from "./atomic-swap/ethereum/contracts/SwapCreator.sol";
import {IEscrowSrc} from "./cross-chain-swap/contracts/interfaces/IEscrowSrc.sol";
import {IEscrow} from "./cross-chain-swap/contracts/interfaces/IEscrow.sol";
import {IBaseEscrow} from "./cross-chain-swap/contracts/interfaces/IBaseEscrow.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Import fee extension
import {AmountGetterWithFee} from "./limit-order-protocol/contracts/extensions/AmountGetterWithFee.sol";

contract XMREscrowSrc is IEscrowSrc {
    using SafeERC20 for IERC20;
    
    SwapCreator public immutable SC;
    
    // Mapping from 1inch orderHash to SwapCreator swapID
    mapping(bytes32 => bytes32) public orderToSwapID;
    
    // Mapping from swapID to swap parameters
    mapping(bytes32 => SwapParams) public swapParams;
    
    // Fee-related storage
    mapping(bytes32 => FeeInfo) public orderFees;
    
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
    
    // Store fee information for each order
    struct FeeInfo {
        uint256 integratorFee;     // Fee percentage in 1e5 format (e.g., 50 = 0.05%)
        uint256 integratorShare;    // Share percentage in 1e2 format (e.g., 50 = 50%)
        uint256 resolverFee;        // Fee percentage in 1e5 format
        address feeRecipient;       // Address to receive fees
    }
    
    // Events
    event SwapCreated(bytes32 orderHash, bytes32 swapID);
    event WithdrawExecuted(bytes32 orderHash, bytes32 swapID, address recipient);
    event CancelExecuted(bytes32 orderHash, bytes32 swapID);
    event FeesCollected(bytes32 orderHash, uint256 integratorFee, uint256 resolverFee, address recipient);
    
    constructor(SwapCreator _sc) { SC = _sc; }

    /* --------------------------------------------------------
       1.  IEscrowSrc – main functions called by 1inch
       -------------------------------------------------------- */
    /**
     * @notice Creates an escrow with support for fee calculation
     * @dev Parses fee data from extraData if available
     */
    function createEscrow(
        bytes32 orderHash,
        address token,uint256 amount,address,address,
        uint48,uint48,bytes calldata extraData
    ) external payable {
        // Parse the extraData to extract fee information and XMR swap data
        // First 6 bytes are fee data, followed by whitelist data, then our XMR swap data
        bytes calldata xmrData;
        uint256 integratorFee = 0;
        uint256 integratorShare = 0;
        uint256 resolverFee = 0;
        address feeRecipient = address(0);
        
        // Check if extraData contains fee information (at least 6 bytes for fee data + 1 byte for whitelist size)
        if (extraData.length >= 7) {
            // Extract fee data
            integratorFee = uint256(uint16(bytes2(extraData[:2])));
            integratorShare = uint256(uint8(extraData[2]));
            resolverFee = uint256(uint16(bytes2(extraData[3:5])));
            
            // Skip whitelist data
            uint256 whitelistSize = uint256(uint8(extraData[6]));
            uint256 whitelistDataLength = 1 + (whitelistSize * 10); // 1 byte for size + 10 bytes per address
            
            // Extract XMR data after fee and whitelist data
            xmrData = extraData[6 + whitelistDataLength:];
            
            // Set fee recipient to msg.sender for now (could be customized in the future)
            feeRecipient = msg.sender;
            
            // Store fee information for this order
            orderFees[orderHash] = FeeInfo({
                integratorFee: integratorFee,
                integratorShare: integratorShare,
                resolverFee: resolverFee,
                feeRecipient: feeRecipient
            });
        } else {
            // If no fee data, use the entire extraData as XMR data
            xmrData = extraData;
        }
        
        // Decode XMR-specific data
        (bytes32 claimC, bytes32 refundC, uint256 nonce) = abi.decode(xmrData, (bytes32, bytes32, uint256));
        
        // Calculate the actual amount after fees
        uint256 valueAfterFees = amount;
        if (integratorFee > 0 || resolverFee > 0) {
            // Apply fee calculation similar to AmountGetterWithFee
            uint256 totalFee = integratorFee + resolverFee;
            valueAfterFees = amount * 100000 / (100000 + totalFee);
        }
        
        // Determine if this is an ETH or token swap
        address asset = address(0);  // Default to ETH
        uint256 value = msg.value;   // Default to msg.value for ETH
        
        // If token is specified, use it instead of ETH
        if (token != address(0)) {
            asset = token;
            value = valueAfterFees; // Use the amount after fees
            
            // Transfer tokens from sender to this contract
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
            
            // If there are fees, distribute them
            if (integratorFee > 0 || resolverFee > 0) {
                uint256 feeAmount = amount - valueAfterFees;
                
                // Calculate integrator and resolver portions
                uint256 integratorAmount = feeAmount * integratorFee / (integratorFee + resolverFee);
                uint256 resolverAmount = feeAmount - integratorAmount;
                
                // Transfer fees to recipient
                if (feeAmount > 0 && feeRecipient != address(0)) {
                    IERC20(token).safeTransfer(feeRecipient, feeAmount);
                    emit FeesCollected(orderHash, integratorAmount, resolverAmount, feeRecipient);
                }
            }
            
            // Approve SwapCreator to spend these tokens (only the amount after fees)
            IERC20(token).approve(address(SC), valueAfterFees);
        }
        
        // Create the swap using SwapCreator
        bytes32 swapID = SC.newSwap{value: msg.value}(
            claimC,
            refundC,
            payable(address(this)), // adapter is the claimer
            1 days, // timeout1 duration (24 hours)
            7 days, // timeout2 duration (7 days)
            asset,  // ETH or token address
            value,  // ETH or token amount (after fees)
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
    // Standard withdraw function from IBaseEscrow
    function withdraw(bytes32 secret, IBaseEscrow.Immutables calldata immutables) external {
        _withdrawInternal(immutables.orderHash, secret, payable(msg.sender));
    }
    
    // WithdrawTo function from IEscrowSrc
    function withdrawTo(bytes32 secret, address target, IEscrow.Immutables calldata immutables) external {
        _withdrawInternal(immutables.orderHash, secret, payable(target));
    }
    
    // PublicWithdraw function from IEscrowSrc
    // This allows anyone to withdraw after the second timeout period
    function publicWithdraw(bytes32 secret, IBaseEscrow.Immutables calldata immutables) external {
        bytes32 orderHash = immutables.orderHash;
        bytes32 swapID = orderToSwapID[orderHash];
        require(swapID != bytes32(0), "Swap not found");
        
        // Get the swap parameters
        SwapParams memory params = swapParams[swapID];
        
        // For public withdrawal, we need to be past the second timeout
        require(block.timestamp > params.timeout2, "Public withdrawal period not reached");
        
        // Convert the Address type to address by using the raw bytes20 value
        address takerAddress = address(uint160(bytes20(abi.encodePacked(immutables.taker))));
        
        // Anyone can trigger the withdrawal, but funds go to the taker
        _withdrawInternal(orderHash, secret, payable(takerAddress));
    }
    
    // Support withdrawal with relayer for privacy-preserving transfers
    // This is an additional function not in the interface but useful for privacy
    function withdrawWithRelayer(
        bytes32 orderHash, 
        bytes32 secret, 
        address payable relayer, 
        uint256 fee,
        uint32 salt,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        // Get the swapID from the orderHash
        bytes32 swapID = orderToSwapID[orderHash];
        require(swapID != bytes32(0), "Swap not found");
        
        // Get the current stage and check if the swap is claimable
        SwapCreator.Stage stage = SC.swaps(swapID);
        require(stage == SwapCreator.Stage.READY || stage == SwapCreator.Stage.PENDING, "Swap not claimable");
        
        // If PENDING, we can't proceed
        if (stage == SwapCreator.Stage.PENDING) {
            revert("Swap not ready - owner must call setReady");
        }
        
        // Reconstruct the Swap struct
        SwapCreator.Swap memory swap = _getSwapStruct(swapID);
        
        // Create the RelaySwap struct for the relayer claim
        SwapCreator.RelaySwap memory relaySwap = SwapCreator.RelaySwap({
            swap: swap,
            fee: fee,
            relayerHash: keccak256(abi.encodePacked(relayer, salt)),
            swapCreator: address(SC)
        });
        
        // Call claimRelayer with the provided signature
        SC.claimRelayer(
            relaySwap,
            secret,
            relayer,
            salt,
            v,
            r,
            s
        );
        
        emit WithdrawExecuted(orderHash, swapID, relayer);
    }
    
    function _withdrawInternal(bytes32 orderHash, bytes32 secret, address recipient) internal {
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
    function cancel(IBaseEscrow.Immutables calldata immutables) external {
        _cancelInternal(immutables.orderHash, msg.sender, bytes32(0));
    }
    
    // PublicCancel function from IEscrowSrc
    // In the 1inch protocol, this would allow anyone to cancel after a timeout
    // However, SwapCreator only allows the owner to call refund, so we need to adapt
    function publicCancel(IBaseEscrow.Immutables calldata immutables) external {
        bytes32 orderHash = immutables.orderHash;
        bytes32 swapID = orderToSwapID[orderHash];
        require(swapID != bytes32(0), "Swap not found");
        
        // Get the swap parameters
        SwapParams memory params = swapParams[swapID];
        
        // For public cancellation, we need to be past the first timeout
        require(block.timestamp > params.timeout1, "Public cancellation period not reached");
        
        // Reconstruct the Swap struct
        SwapCreator.Swap memory swap = _getSwapStruct(swapID);
        
        // SwapCreator only allows the owner to call refund
        // Check if the caller is the owner
        require(params.owner == msg.sender, "Only owner can cancel, even after timeout");
        
        // Call refund with empty secret (will check timeout)
        SC.refund(swap, bytes32(0));
        
        emit CancelExecuted(orderHash, swapID);
    }
    
    // Additional function to support refund with secret
    function cancelWithSecret(bytes32 orderHash, bytes32 refundSecret) external {
        _cancelInternal(orderHash, msg.sender, refundSecret);
    }
    
    function _cancelInternal(bytes32 orderHash, address caller, bytes32 refundSecret) internal {
        // Get the swapID from orderHash
        bytes32 swapID = orderToSwapID[orderHash];
        require(swapID != bytes32(0), "Unknown order");
        
        // Get the current stage
        SwapCreator.Stage stage = SC.swaps(swapID);
        
        // Ensure the swap is not already completed
        require(stage != SwapCreator.Stage.COMPLETED, "Swap already completed");
        
        // Get the swap parameters
        SwapParams memory params = swapParams[swapID];
        
        // For cancellation, the caller must be the owner
        require(params.owner == caller, "Only owner can cancel");
        
        // Reconstruct the Swap struct
        SwapCreator.Swap memory swap = _getSwapStruct(swapID);
        
        // If refundSecret is provided, use it for refund
        if (refundSecret != bytes32(0)) {
            // Call refund with the provided secret
            SC.refund(swap, refundSecret);
        } else {
            // Otherwise, ensure the timeout has passed
            require(block.timestamp > params.timeout1, "Timeout not reached");
            
            // Call refund with empty secret (will check timeout)
            SC.refund(swap, bytes32(0));
        }
        
        emit CancelExecuted(orderHash, swapID);
    }
    
    // Implement rescueFunds from IBaseEscrow interface
    function rescueFunds(address token, uint256 amount, IBaseEscrow.Immutables calldata immutables) external {
        // In our implementation, rescueFunds is similar to cancel but with specific token and amount
        bytes32 orderHash = immutables.orderHash;
        bytes32 swapID = orderToSwapID[orderHash];
        require(swapID != bytes32(0), "Unknown order");
        
        // Get the swap parameters
        SwapParams memory params = swapParams[swapID];
        
        // Only the taker (as defined in immutables) can rescue funds
        // Convert the Address type to address by using the raw bytes20 value
        address takerAddress = address(uint160(bytes20(abi.encodePacked(immutables.taker))));
        require(takerAddress == msg.sender, "Only taker can rescue funds");
        
        // Ensure the timeout has passed (RESCUE_DELAY is 0 in our implementation)
        require(block.timestamp > params.timeout1, "Timeout not reached");
        
        // Reconstruct the Swap struct
        SwapCreator.Swap memory swap = _getSwapStruct(swapID);
        
        // Verify the token matches the swap's asset
        if (token == address(0)) {
            require(swap.asset == address(0), "Asset mismatch");
        } else {
            require(swap.asset == token, "Asset mismatch");
        }
        
        // Call refund with empty secret (will check timeout)
        SC.refund(swap, bytes32(0));
        
        emit FundsRescued(token, amount);
    }
    
    // No duplicate function needed
    
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
