# GP Token: Restricted Expiring Token

[![en](https://img.shields.io/badge/lang-en-red.svg)](./README.md)
[![jp](https://img.shields.io/badge/lang-jp-green.svg)](./README_jp.md)

Contracts for the GP token project.
This repository implements an ERC1155-based token with ERC20-like behavior and a self-expiring mechanism, coupled with some transfer whitelist restrictions.
The Expiring Token smart contract is built using Hardhat.

## Base Features

- ERC1155 implementation with ERC20-like interface
- Self-expiring tokens with the expiration period configurable at token launch.
- Role-based access control for minting and transfers
- Compatibility with both ERC1155 and ERC20 interfaces

## Integration and API overview

For more details about how to compile the contract and get the ABI for client-side integration, see the following section.

### General concepts

The GP token is an instance of the ExpiringToken contract.

- This token doesn't have a fixed supply defined at token initialization
- Tokens may be minted by a minter service account. The default use case for this project is that this service account is triggered by external events, such as NFTs burned on another (non-EVM) chain.
- Holders of this token may not freely send/receive this token:

  - The contract implements a role-based whitelist, and destination accounts need to have an OPERATOR role for the transfer to be allowed.

- Although standard accounts can be whitelisted, the easiest way to integrate the GP token in your web2 or web3 project is to use the other contract in this repository: TokenReceiver
  - Please contact us so that we may deploy a white-listed instance of the token receiver for your integration.
  - This TokenReceiver contract will emit specific events when receiving GP tokens, which will make back-end integration with your system easier.
  - If you are building an application which is mainly web2, this will be the easiest option to trigger some arbitrary code execution when users send GP tokens to your service.
  - Alternatively, if your project is mainly web3, you may either build your own receiver contract (which could in turn trigger some of your contracts), or use the instance we deployed for your service, combined with a Keeper network (e.g Chainlink Keeper) to perform some cross-contract interactions.

If you need to integrate some functions of the GP token in your front-end, these are the functions which are most likely to be useful:

- `balanceOf(address)` (ERC20-style) will provide the effective non-expired balance of an address
- `transfer(address to, uint256 amount)` or `safeTransferFrom(address from, address to,uint256 amount, bytes data)` (ERC20-style) will allow you to transfer tokens, using the oldest valid token classes in priority.

To receive notifications when tokens are sent to your instance of the TokenReceiver contract, you only need to listen to `TokensReceived` events. When the contract is set up, it will be configured to ensure that events are only emitted when "real" GP tokens are received.

### Deployed instances

```
Polygon Mainnet main instance: 0xdC4AE8cC75FcA9Da7054e03E7A770DE72A66bEB1
Polygon Mainnet test instance: 0x66C3416a893255bFfBbCDEF6Fafc6324F0b73FB3
```

If you wish for another instance to be deployed on another network (or a testnet), please file an issue and we'll be in touch!

### How to integrate the GP token within your project

This section aims to describe how to integrate the GP token within game-related projects, where using (i.e paying) GPs would trigger some arbitrary process server-side.
Example: a user spends some GP tokens on your game to run a gacha process and obtain game-related items.

Since the GP token behaves mostly like an ERC20 token, its integration within your project is similar. However, transfers are restricted to whitelisted addresses, so the following process needs to be done:

1. Contact us:

- Either you wish to use an existing address to receive GPs, or you wish to use the dedicated TokenReceiver contract [recommended]
- In all cases, this address needs to be whitelisted at the GP contract level (which may be done by GP admins)

2. From your front-end, integrate the GP token

- Read queries: balanceOf will directly return the non-expired tokens which may be used
- Transaction to integrate: use safeTransferFrom to trigger a transfer from the user's wallet to your address (or token receiver)

```
const signer = await provider.getSigner();
const userAddress = await signer.getAddress();
const tokenContract = new ethers.Contract(
  gpTokenAddress,
  GP_TOKEN_ABI,
  signer
);
const approveTx = await tokenContract.approve(
  tokenContract.address,
  ethers.MaxUint256 // Feel free to change to your system's logic
);
await approveTx.wait();
const tx = await tokenContract.safeTransferFrom(
  userAddress,
  tokenReceiverAddress,
  amount
);
```

3. Watch the events from the TokenReceiver contract

- On your backend (or whatever service which is expected to run the process), you will want to detect when events are emitted.

```
const tokenContract = new ethers.Contract(
  gpTokenAddress,
  GP_TOKEN_ABI,
  signer
);
const filter = contract.filters.TokensReceived();
const events = await contract.queryFilter(filter, fromBlock);

// Process the events as required - these events will include the sender address, the amount, the tokenClassId, and the timestamp.
```

## Getting started with the code

### Prerequisites

- Node.js (v20+ recommended)
- Hardhat

### Compiling the Contract

Compile the smart contract using Hardhat:

```
npx hardhat compile
```

### Running Tests

Execute the test suite:

```
npx hardhat test
```

To get a gas report, run:

```
REPORT_GAS=true npx hardhat test
```

### Deploying the Contract

To deploy the contract to a local Hardhat network:

1. Start a local node:

   ```
   npx hardhat node
   ```

2. Deploy the contract:
   ```
   npx hardhat run scripts/deploy.js --network localhost
   ```

### Verifying the deployed contract

```
# For the implementation
npx hardhat verify --network sandverse 0x66aA7745ed8133BaD2b2aE20dcdEFf8b9f50F687
# For the proxy
npx hardhat verify --network sandverse 0xa9C4DA65419cD08871544989ce342dC87eFbeA41 AutoExpTkn EXP https://myapi.com/metadata/\{id\}.json 180
# For the token receiver factory
npx hardhat verify --network sandverse 0x91A2D4D6a29Ac0d76514A316239D26ff803C9C48
```

## Contract Overview

The `ExpiringToken` contract combines features of ERC1155 and ERC20 tokens with an expiration mechanism. Key features include:

- Minting new tokens with automatic expiration dates
- Tracking token balances across different "token classes" (minting periods)
- Transferring only non-expired tokens
- Querying expired and non-expired token balances

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the Apache License, Version 2.0.
