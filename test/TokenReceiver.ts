import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { ExpiringToken } from "../typechain-types";

describe("TokenReceiver", function () {
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));

  async function deployTokenReceiverFixture() {
    const expirationDays = 30;

    const [owner, operator, user1, user2] = await ethers.getSigners();

    // Deploy ExpiringToken first
    const ExpiringToken = await ethers.getContractFactory("ExpiringToken");
    const token = (await upgrades.deployProxy(
      ExpiringToken,
      ["ExpiringToken", "EXT", "https://token-uri.com", expirationDays],
      {
        initializer: "initialize",
        kind: "uups",
      }
    )) as unknown as ExpiringToken;
    const tokenAddress = await token.getAddress();

    // Deploy TokenReceiver
    const TokenReceiver = await ethers.getContractFactory("TokenReceiver");
    const receiver = await TokenReceiver.deploy(owner, tokenAddress);

    // Grant OPERATOR_ROLE to the receiver
    await token.grantRole(OPERATOR_ROLE, await receiver.getAddress());

    return { token, receiver, expirationDays, owner, operator, user1, user2 };
  }

  it("1. Correctly initializes with registered token", async function () {
    const { token, receiver } = await loadFixture(deployTokenReceiverFixture);
    expect(await receiver.registeredToken()).to.equal(await token.getAddress());
  });

  it("2. Emits event when receiving tokens from registered token", async function () {
    const { token, receiver, owner, user1, user2 } = await loadFixture(
      deployTokenReceiverFixture
    );

    await token.connect(owner).mint(user1.address, 100);
    const currentTime = await time.latest();
    const tokenClassId = Math.floor(currentTime / 86400);
    const receiverAddress = await receiver.getAddress();

    const tx = await token
      .connect(user1)
      ["safeTransferFrom(address,address,uint256,bytes)"](
        user1.address,
        receiverAddress,
        50,
        "0x"
      );
    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error("Transaction receipt is null");
    }
    const block = await ethers.provider.getBlock(receipt.blockNumber);
    if (!block) {
      throw new Error("Block not found");
    }
    const blockTimestamp = block.timestamp;
    await expect(tx)
      .to.emit(receiver, "TokensReceived")
      .withArgs(user1.address, 50, tokenClassId, blockTimestamp);
  });

  it("3. Does not emit event when receiving tokens from non-registered token", async function () {
    const { receiver, owner, user1 } = await loadFixture(
      deployTokenReceiverFixture
    );

    // Deploy another token contract
    const ExpiringToken = await ethers.getContractFactory("ExpiringToken");
    const anotherToken = (await upgrades.deployProxy(
      ExpiringToken,
      ["Another", "ANT", "https://token-uri.com", 30],
      {
        initializer: "initialize",
        kind: "uups",
      }
    )) as unknown as ExpiringToken;

    await anotherToken.grantRole(OPERATOR_ROLE, await receiver.getAddress());
    await anotherToken.connect(owner).mint(user1.address, 100);

    const currentTime = await time.latest();
    const tokenClassId = Math.floor(currentTime / 86400);

    const tx = await anotherToken
      .connect(user1)
      ["safeTransferFrom(address,address,uint256,uint256,bytes)"](
        user1.address,
        await receiver.getAddress(),
        tokenClassId,
        50,
        "0x"
      );

    await expect(tx).to.not.emit(receiver, "TokensReceived");
  });

  it("4. Correctly handles batch transfers", async function () {
    const { token, receiver, owner, user1 } = await loadFixture(
      deployTokenReceiverFixture
    );

    // Mint tokens on two consecutive days
    await token.connect(owner).mint(user1.address, 100);
    await time.increase(86400); // Advance 1 day
    await token.connect(owner).mint(user1.address, 100);

    const currentTime = await time.latest();
    const tokenClassId1 = Math.floor((currentTime - 86400) / 86400);
    const tokenClassId2 = Math.floor(currentTime / 86400);

    // Prepare batch transfer
    const tx = await token
      .connect(user1)
      .safeBatchTransferFrom(
        user1.address,
        await receiver.getAddress(),
        [tokenClassId1, tokenClassId2],
        [30, 40],
        "0x"
      );
    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error("Transaction receipt is null");
    }
    const block = await ethers.provider.getBlock(receipt.blockNumber);
    if (!block) {
      throw new Error("Block not found");
    }
    const blockTimestamp = block.timestamp;

    await expect(tx)
      .to.emit(receiver, "TokensReceived")
      .withArgs(user1.address, 30, tokenClassId1, blockTimestamp)
      .to.emit(receiver, "TokensReceived")
      .withArgs(user1.address, 40, tokenClassId2, blockTimestamp);
  });

  it("5. Only owner can update registered token", async function () {
    const { receiver, user1 } = await loadFixture(deployTokenReceiverFixture);

    const ExpiringToken = await ethers.getContractFactory("ExpiringToken");
    const newToken = (await upgrades.deployProxy(
      ExpiringToken,
      ["New", "NEW", "https://token-uri.com", 30],
      {
        initializer: "initialize",
        kind: "uups",
      }
    )) as unknown as ExpiringToken;

    await expect(
      receiver.connect(user1).updateRegisteredToken(await newToken.getAddress())
    ).to.be.reverted;
  });

  it("6. Correctly reports current and expired balances", async function () {
    const { token, receiver, owner } = await loadFixture(
      deployTokenReceiverFixture
    );

    await token.connect(owner).mint(await receiver.getAddress(), 100);
    expect(await receiver.currentBalance()).to.equal(100);
    expect(await receiver.expiredBalance()).to.equal(0);

    // Advance time past expiration
    await time.increase(31 * 86400); // 31 days

    expect(await receiver.currentBalance()).to.equal(0);
    expect(await receiver.expiredBalance()).to.equal(100);
  });

  it("7. Cannot initialize with zero address", async function () {
    const { owner } = await loadFixture(deployTokenReceiverFixture);

    const TokenReceiver = await ethers.getContractFactory("TokenReceiver");
    await expect(
      TokenReceiver.deploy(owner, ethers.ZeroAddress)
    ).to.be.revertedWith("Invalid token address");
  });

  it("8. Cannot update registered token to zero address", async function () {
    const { receiver, owner } = await loadFixture(deployTokenReceiverFixture);

    await expect(
      receiver.connect(owner).updateRegisteredToken(ethers.ZeroAddress)
    ).to.be.revertedWith("Invalid token address");
  });
});
