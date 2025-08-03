// SPDX-License-Identifier: LGPLv3
pragma solidity ^0.8.19;

import {SwapCreator} from "./atomic-swap/ethereum/contracts/SwapCreator.sol";
import {IEscrowDst} from "./cross-chain-swap/contracts/interfaces/IEscrowDst.sol";
import {IEscrow} from "./cross-chain-swap/contracts/interfaces/IEscrow.sol";
import {IBaseEscrow} from "./cross-chain-swap/contracts/interfaces/IBaseEscrow.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Import fee extension
import {AmountGetterWithFee} from "./limit-order-protocol/contracts/extensions/AmountGetterWithFee.sol";

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
       1.  IEscrowDst – main functions called by 1inch
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
            asset,
            value, // ETH or token amount (after fees)
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
