// SPDX-License-Identifier: LGPLv3
pragma solidity ^0.8.19;

import {Script, console2} from "forge-std/Script.sol";
import {SwapCreator} from "../contracts/atomic-swap/ethereum/contracts/SwapCreator.sol";
import {XMREscrowSrc} from "../contracts/XMREscrowSrc.sol";
import {XMREscrowDst} from "../contracts/XMREscrowDst.sol";

contract DeployContracts is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy SwapCreator first
        SwapCreator swapCreator = new SwapCreator();
        console2.log("SwapCreator deployed at:", address(swapCreator));
        
        // Deploy XMREscrowSrc with the SwapCreator address
        XMREscrowSrc xmrEscrowSrc = new XMREscrowSrc(swapCreator);
        console2.log("XMREscrowSrc deployed at:", address(xmrEscrowSrc));
        
        // Deploy XMREscrowDst with the SwapCreator address
        XMREscrowDst xmrEscrowDst = new XMREscrowDst(swapCreator);
        console2.log("XMREscrowDst deployed at:", address(xmrEscrowDst));
        
        vm.stopBroadcast();
    }
}
