import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";

const config: HardhatUserConfig = {
  solidity: "0.8.27",
  networks: {
    hardhat: {
      chainId: 1337
    },
    amoy: {
      url: "https://rpc-amoy.polygon.technology",
      accounts: [`0x${process.env.PRIVATE_KEY}`],
    },
    polygon: {
      url: "https://polygon-rpc.com",
      accounts: [`0x${process.env.PRIVATE_KEY}`],
    },
    arbitrum: {
      url: "https://arbitrum.llamarpc.com",
      accounts: [`0x${process.env.PRIVATE_KEY}`],
    },
    sandverse: {
      url: 'https://rpc.sandverse.oasys.games/',
      chainId: 20197,
      accounts: [`0x${process.env.PRIVATE_KEY}`],
      gasPrice: 0,
    },
  },
  etherscan: {
    apiKey: process.env.POLYGONSCAN_API_KEY,
    customChains: [
      {
        network: "sandverse",
        chainId: 20197,
        urls: {
          apiURL: "http://explorer.sandverse.oasys.games/api",
          browserURL: "https://explorer.sandverse.oasys.games"
        }
      }
    ]  
  }
};

export default config;