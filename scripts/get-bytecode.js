const hre = require("hardhat");

async function main() {
  const swapCreatorAddress = "0x1182005572533c41284Fd66baF5952133bF4d7a9"; // Our newly deployed SwapCreator
  
  console.log("Getting bytecode for SwapCreator at:", swapCreatorAddress);
  
  const provider = hre.ethers.provider;
  const bytecode = await provider.getCode(swapCreatorAddress);
  
  console.log("Bytecode:");
  console.log(bytecode);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
