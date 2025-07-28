// SPDX-License-Identifier: LGPLv3
pragma solidity ^0.8.19;

import {SwapCreator} from "./atomic-swap/ethereum/contracts/SwapCreator.sol";
import {IEscrowSrc} from "./cross-chain-swap/contracts/interfaces/IEscrowSrc.sol";
import {IEscrow} from "./cross-chain-swap/contracts/interfaces/IEscrow.sol";
import {IBaseEscrow} from "./cross-chain-swap/contracts/interfaces/IBaseEscrow.sol";

contract SwapCreatorAdapter is IEscrowSrc {
    SwapCreator public immutable SC;
    constructor(SwapCreator _sc) { SC = _sc; }

    /* --------------------------------------------------------
       1.  IEscrowSrc – only these two are EVER called by 1inch
       -------------------------------------------------------- */
    function createEscrow(
        bytes32,address,uint256,address,address,
        uint48,uint48,bytes calldata extraData
    ) external payable {
        (bytes32 claimC,bytes32 refundC,uint256 nonce) = abi.decode(extraData,(bytes32,bytes32,uint256));
        SC.newSwap{value: msg.value}(claimC,refundC,payable(msg.sender),uint256(0),uint256(0),address(0),msg.value,nonce);
    }

    function predictEscrowAddress(
        bytes32,address,uint256,address,address,uint48,uint48,bytes calldata
    ) external view returns (address) { return address(SC); }

    /* --------------------------------------------------------
       2.  Stub everything else – never executed
       -------------------------------------------------------- */
    function withdraw(bytes32,IBaseEscrow.Immutables calldata) external pure { revert("stub"); }
    function withdrawTo(bytes32,address,IEscrow.Immutables calldata) external pure { revert("stub"); }
    function publicWithdraw(bytes32,IBaseEscrow.Immutables calldata) external pure { revert("stub"); }
    function cancel(IBaseEscrow.Immutables calldata) external pure { revert("stub"); }
    function publicCancel(IBaseEscrow.Immutables calldata) external pure { revert("stub"); }
    function rescueFunds(address,uint256,IBaseEscrow.Immutables calldata) external pure { revert("stub"); }

    /* constants */
    function PROXY_BYTECODE_HASH() external pure returns (bytes32) { return bytes32(0); }
    function RESCUE_DELAY() external pure returns (uint256) { return 0; }
    function FACTORY() external view returns (address) { return address(this); }
}
