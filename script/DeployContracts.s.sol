// SPDX-License-Identifier: LGPLv3
pragma solidity ^0.8.19;

import {Script, console2} from "forge-std/Script.sol";
import {SwapCreator} from "../contracts/atomic-swap/ethereum/contracts/SwapCreator.sol";
import {SwapCreatorAdapter} from "../contracts/SwapCreatorAdapter.sol";

contract DeployContracts is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy SwapCreator first
        SwapCreator swapCreator = new SwapCreator();
        console2.log("SwapCreator deployed at:", address(swapCreator));
        
        // Deploy SwapCreatorAdapter with the SwapCreator address
        SwapCreatorAdapter swapCreatorAdapter = new SwapCreatorAdapter(swapCreator);
        console2.log("SwapCreatorAdapter deployed at:", address(swapCreatorAdapter));
        
        vm.stopBroadcast();
    }
}
