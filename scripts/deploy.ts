import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(deployerBalance));

  const uri = "https://no-metadata-for-this-token.com/metadata/{id}.json";
  const name = "GP TOKEN";
  const symbol = "GP";
  const expirationPeriodDays = 180;
  
  const ExpiringToken = await ethers.getContractFactory("ExpiringToken");
  
  const expiringToken = await upgrades.deployProxy(ExpiringToken, 
    [name, symbol, uri, expirationPeriodDays], 
    { 
      initializer: "initialize",
      kind: "uups",
      salt: "gptokenbaseinstancev1",
      createFactoryAddress: "0x4e59b44847b379578588920cA78FbF26c0B4956C"
    }
  );

  await expiringToken.waitForDeployment();

  const proxyContractAddr = await expiringToken.getAddress();
  console.log("ExpiringToken proxy contract deployed to:", proxyContractAddr);

  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyContractAddr);
  console.log("ExpiringToken Implementation Address:", implementationAddress);

  const proxyAdminAddress = await upgrades.erc1967.getAdminAddress(proxyContractAddr);
  console.log("ExpiringToken Proxy Admin Address:", proxyAdminAddress);

  const TokenReceiverFactory = await ethers.getContractFactory("TokenReceiverFactory");
  const tokenReceiverFactory = await TokenReceiverFactory.deploy();
  await tokenReceiverFactory.waitForDeployment();

  const receiverFactoryContractAddr = await tokenReceiverFactory.getAddress();
  console.log("TokenReceiverFactory contract deployed to:", receiverFactoryContractAddr);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});