// SPDX-License-Identifier: LGPLv3

pragma solidity ^0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IOrderMixin} from "./cross-chain-swap/lib/limit-order-protocol/contracts/interfaces/IOrderMixin.sol";
import {TakerTraits} from "./cross-chain-swap/lib/limit-order-protocol/contracts/libraries/TakerTraitsLib.sol";

import {RevertReasonForwarder} from "./cross-chain-swap/lib/solidity-utils/contracts/libraries/RevertReasonForwarder.sol";
import {IEscrowFactory} from "./cross-chain-swap/contracts/interfaces/IEscrowFactory.sol";
import {IBaseEscrow} from "./cross-chain-swap/contracts/interfaces/IBaseEscrow.sol";
import {TimelocksLib, Timelocks} from "./cross-chain-swap/contracts/libraries/TimelocksLib.sol";
import {IEscrow} from "./cross-chain-swap/contracts/interfaces/IEscrow.sol";
import {ImmutablesLib} from "./cross-chain-swap/contracts/libraries/ImmutablesLib.sol";

// Import fee extension
import {AmountGetterWithFee} from "./limit-order-protocol/contracts/extensions/AmountGetterWithFee.sol";

// Import our XMR escrow contracts
import {XMREscrowSrc} from "./XMREscrowSrc.sol";
import {XMREscrowDst} from "./XMREscrowDst.sol";
import {SwapCreator} from "./atomic-swap/ethereum/contracts/SwapCreator.sol";

/**
 * @title Sample implementation of a Resolver contract for cross-chain swap.
 * @dev It is important when deploying an escrow on the source chain to send the safety deposit and deploy the escrow in the same
 * transaction, since the address of the escrow depends on the block.timestamp.
 * You can find sample code for this in the {ResolverExample-deploySrc}.
 *
 * @custom:security-contact security@1inch.io
 */
contract Resolver is Ownable {
    using ImmutablesLib for IBaseEscrow.Immutables;
    using TimelocksLib for Timelocks;

    error InvalidLength();
    error LengthMismatch();

    IEscrowFactory private immutable _FACTORY;
    IOrderMixin private immutable _LOP;
    AmountGetterWithFee private immutable _FEE_GETTER;
    
    // Fee constants
    uint16 private constant DEFAULT_INTEGRATOR_FEE = 50; // 0.05% in 1e5 format
    uint8 private constant DEFAULT_INTEGRATOR_SHARE = 50; // 50% in 1e2 format
    uint16 private constant DEFAULT_RESOLVER_FEE = 50; // 0.05% in 1e5 format
    uint8 private constant DEFAULT_WHITELIST_DISCOUNT = 50; // 50% in 1e2 format

    constructor(IEscrowFactory factory, IOrderMixin lop, AmountGetterWithFee feeGetter, address initialOwner) Ownable(initialOwner) {
        _FACTORY = factory;
        _LOP = lop;
        _FEE_GETTER = feeGetter;
    }

    receive() external payable {} // solhint-disable-line no-empty-blocks

    /**
     * @notice See {IResolverExample-deploySrc}.
     */
    /**
     * @notice Deploys a source escrow and fills the order with fee calculation
     * @dev Adds fee data to the args parameter before calling fillOrderArgs
     */
    function deploySrc(
        IBaseEscrow.Immutables calldata immutables,
        IOrderMixin.Order calldata order,
        bytes32 r,
        bytes32 vs,
        uint256 amount,
        TakerTraits takerTraits,
        bytes calldata args
    ) external payable onlyOwner {

        IBaseEscrow.Immutables memory immutablesMem = immutables;
        immutablesMem.timelocks = TimelocksLib.setDeployedAt(immutables.timelocks, block.timestamp);
        address computed = _FACTORY.addressOfEscrowSrc(immutablesMem);

        (bool success,) = address(computed).call{value: immutablesMem.safetyDeposit}("");
        if (!success) revert IBaseEscrow.NativeTokenSendingFailure();

        // _ARGS_HAS_TARGET = 1 << 251
        takerTraits = TakerTraits.wrap(TakerTraits.unwrap(takerTraits) | uint256(1 << 251));
        
        // Prepare fee data
        // Format: [2 bytes integrator fee][1 byte integrator share][2 bytes resolver fee][1 byte whitelist discount][whitelist data][original args]
        bytes memory feeData = abi.encodePacked(
            bytes2(DEFAULT_INTEGRATOR_FEE),
            bytes1(DEFAULT_INTEGRATOR_SHARE),
            bytes2(DEFAULT_RESOLVER_FEE),
            bytes1(DEFAULT_WHITELIST_DISCOUNT),
            bytes1(0) // Empty whitelist (0 size)
        );
        
        // Combine fee data with original args
        bytes memory argsWithFee = bytes.concat(feeData, args);
        
        // Combine target address with args
        bytes memory argsMem = abi.encodePacked(computed, argsWithFee);
        _LOP.fillOrderArgs(order, r, vs, amount, takerTraits, argsMem);
    }

    /**
     * @notice See {IResolverExample-deployDst}.
     */
    function deployDst(IBaseEscrow.Immutables calldata dstImmutables, uint256 srcCancellationTimestamp) external onlyOwner payable {
        _FACTORY.createDstEscrow{value: msg.value}(dstImmutables, srcCancellationTimestamp);
    }

    function withdraw(IEscrow escrow, bytes32 secret, IBaseEscrow.Immutables calldata immutables) external {
        escrow.withdraw(secret, immutables);
    }


    function cancel(IEscrow escrow, IBaseEscrow.Immutables calldata immutables) external {
        escrow.cancel(immutables);
    }

    /**
     * @notice See {IResolverExample-arbitraryCalls}.
     */
    function arbitraryCalls(address[] calldata targets, bytes[] calldata arguments) external onlyOwner {
        uint256 length = targets.length;
        if (targets.length != arguments.length) revert LengthMismatch();
        for (uint256 i = 0; i < length; ++i) {
            // solhint-disable-next-line avoid-low-level-calls
            (bool success,) = targets[i].call(arguments[i]);
            if (!success) RevertReasonForwarder.reRevert();
        }
    }
}
