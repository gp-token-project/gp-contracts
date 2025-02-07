import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { ExpiringToken } from "../typechain-types";

describe("ExpiringToken", function () {
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));

  async function deployUpgradeableTokenFixture() {
    const expirationDays = 30;

    // Contracts are deployed using the first signer/account by default
    const [owner, operator, user1, user2] = await ethers.getSigners();

    const ExpiringToken = await ethers.getContractFactory("ExpiringToken");
    const token = await upgrades.deployProxy(
      ExpiringToken,
      ["ExpiringToken", "EXT", "https://token-uri.com", expirationDays],
      {
        initializer: "initialize",
        kind: "uups",
      }
    ) as unknown as ExpiringToken;

    return { token, expirationDays, owner, operator, user1, user2 };
  }

  it("1. Owner can mint tokens", async function () {
    const { token, expirationDays, owner, operator, user1, user2 } =
      await loadFixture(deployUpgradeableTokenFixture);
    await expect(token.connect(owner).mint(user1.address, 100))
      .to.emit(token, "TransferSingle")
      .withArgs(
        owner.address,
        ethers.ZeroAddress,
        user1.address,
        (id: bigint) => id < ethers.MaxUint256,
        100
      );

    expect(await token["balanceOf(address)"](user1.address)).to.equal(100);
  });

  it("2. Operator with MINTER_ROLE can mint tokens", async function () {
    const { token, expirationDays, owner, operator, user1, user2 } =
      await loadFixture(deployUpgradeableTokenFixture);
    await token.grantRole(MINTER_ROLE, operator.address);
    await expect(token.connect(operator).mint(user1.address, 100))
      .to.emit(token, "TransferSingle")
      .withArgs(
        operator.address,
        ethers.ZeroAddress,
        user1.address,
        (id: bigint) => id < ethers.MaxUint256,
        100
      );

    expect(await token["balanceOf(address)"](user1.address)).to.equal(100);
  });

  it("3. Standard account cannot mint tokens", async function () {
    const { token, expirationDays, owner, operator, user1, user2 } =
      await loadFixture(deployUpgradeableTokenFixture);

    await expect(token.connect(user1).mint(user2.address, 100))
      .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
      .withArgs(user1.address, MINTER_ROLE);
  });

  it("4. Transferring tokens to a general account reverts", async function () {
    const { token, expirationDays, owner, operator, user1, user2 } =
      await loadFixture(deployUpgradeableTokenFixture);
    await token.connect(owner).mint(user1.address, 100);
    // Both versions of transfers (smart and id-specific) should have the same behaviour
    await expect(
      token
        .connect(user1)
        ["safeTransferFrom(address,address,uint256,bytes)"](
          user1.address,
          user2.address,
          50,
          "0x"
        )
    ).to.be.revertedWith("Transfer to non-approved address is not allowed");

    const currentTime = await time.latest();
    const latestTokenId = Math.floor(currentTime / 86400);
    await expect(
      token
        .connect(user1)
        ["safeTransferFrom(address,address,uint256,uint256,bytes)"](
          user1.address,
          user2.address,
          latestTokenId,
          50,
          "0x"
        )
    ).to.be.revertedWith("Transfer to non-approved address is not allowed");
  });

  it("5. Can transfer tokens to a whitelisted account using approve and safeTransferFrom", async function () {
    const { token, expirationDays, owner, operator, user1, user2 } =
      await loadFixture(deployUpgradeableTokenFixture);
    await token.grantRole(OPERATOR_ROLE, operator.address);
    await token.connect(owner).mint(user1.address, 75);
    expect(await token["balanceOf(address)"](user1.address)).to.equal(75);

    await token.connect(user1).setApprovalForAll(operator.address, true);

    expect(await token["balanceOf(address)"](user1.address)).to.equal(75);

    await expect(
      token
        .connect(operator)
        ["safeTransferFrom(address,address,uint256,bytes)"](
          user1.address,
          operator.address,
          50,
          "0x"
        )
    )
      .to.emit(token, "TransferSingle")
      .withArgs(
        await token.getAddress(),
        user1.address,
        operator.address,
        (id: bigint) => id < ethers.MaxUint256,
        50
      );

    expect(await token["balanceOf(address)"](user1.address)).to.equal(25);
    expect(await token["balanceOf(address)"](operator.address)).to.equal(50);
  });

  it("6. balanceOf returns sum of balances across multiple asset classes", async function () {
    const { token, expirationDays, owner, operator, user1, user2 } =
      await loadFixture(deployUpgradeableTokenFixture);
    await token.connect(owner).mint(user1.address, 100);
    await ethers.provider.send("evm_increaseTime", [86400]); // Advance 1 day
    await ethers.provider.send("evm_mine", []);
    await token.connect(owner).mint(user1.address, 200);
    await ethers.provider.send("evm_increaseTime", [86400]); // Advance 1 day
    await ethers.provider.send("evm_mine", []);
    await token.connect(owner).mint(user1.address, 300);

    expect(await token["balanceOf(address)"](user1.address)).to.equal(600);
  });

  it("7. Balance only includes active tokens after some have expired", async function () {
    const { token, expirationDays, owner, operator, user1, user2 } =
      await loadFixture(deployUpgradeableTokenFixture);
    await token.connect(owner).mint(user1.address, 100);
    await ethers.provider.send("evm_increaseTime", [15 * 86400]); // Advance 15 days
    await ethers.provider.send("evm_mine", []);
    await token.connect(owner).mint(user1.address, 200);
    await ethers.provider.send("evm_increaseTime", [20 * 86400]); // Advance 20 days
    await ethers.provider.send("evm_mine", []);

    expect(await token["balanceOf(address)"](user1.address)).to.equal(200);
  });

  it("8. Cannot transfer expired tokens", async function () {
    const { token, expirationDays, owner, operator, user1, user2 } =
      await loadFixture(deployUpgradeableTokenFixture);
    await token.grantRole(OPERATOR_ROLE, operator.address);
    await token.connect(owner).mint(user1.address, 100);
    await ethers.provider.send("evm_increaseTime", [31 * 86400]); // Advance 31 days
    await ethers.provider.send("evm_mine", []);

    await token.connect(user1).setApprovalForAll(operator.address, true);
    const currentTime = await time.latest();
    const latestTokenId = Math.floor(currentTime / 86400);

    await expect(
      token
        .connect(user1)
        ["safeTransferFrom(address,address,uint256,bytes)"](
          user1.address,
          operator.address,
          50,
          "0x"
        )
    ).to.be.revertedWith("Insufficient non-expired tokens");
  });

  it("9. Expired tokens are not included in balance", async function () {
    const { token, expirationDays, owner, user1 } = await loadFixture(
      deployUpgradeableTokenFixture
    );
    await token.connect(owner).mint(user1.address, 100);
    expect(await token["balanceOf(address)"](user1.address)).to.equal(100);

    await time.increase(expirationDays * 24 * 60 * 60 + 1);
    expect(await token["balanceOf(address)"](user1.address)).to.equal(0);
  });

  it("10. expiredTokenBalance correctly reports expired tokens", async function () {
    const { token, expirationDays, owner, user1 } = await loadFixture(
      deployUpgradeableTokenFixture
    );
    await token.connect(owner).mint(user1.address, 100);
    expect(await token.expiredTokenBalance(user1.address)).to.equal(0);

    await time.increase(expirationDays * 24 * 60 * 60 + 1);
    expect(await token.expiredTokenBalance(user1.address)).to.equal(100);
  });

  it("11. Cannot transfer more tokens than non-expired balance", async function () {
    const { token, expirationDays, owner, operator, user1, user2 } =
      await loadFixture(deployUpgradeableTokenFixture);
    await token.grantRole(OPERATOR_ROLE, operator.address);
    await token.connect(owner).mint(user1.address, 100);
    await time.increase((expirationDays / 2) * 24 * 60 * 60);
    await token.connect(owner).mint(user1.address, 50);

    await token.connect(user1).setApprovalForAll(operator.address, true);

    await expect(
      token
        .connect(operator)
        ["safeTransferFrom(address,address,uint256,bytes)"](
          user1.address,
          operator.address,
          151,
          "0x"
        )
    ).to.be.revertedWith("Insufficient non-expired tokens");
  });

  it("12. ERC20 allowance and transferFrom work correctly", async function () {
    const { token, owner, user1, user2, operator } = await loadFixture(
      deployUpgradeableTokenFixture
    );
    await token.grantRole(OPERATOR_ROLE, operator.address);
    await token.connect(owner).mint(user1.address, 100);
    await token.connect(user1).approve(operator.address, 50);

    expect(await token.allowance(user1.address, operator.address)).to.equal(50);
    await expect(
      token.connect(operator).transferFrom(user1.address, operator.address, 50)
    )
      .to.emit(token, "TransferSingle")
      .withArgs(
        token.getAddress(),
        user1.address,
        operator.address,
        (id: bigint) => id < ethers.MaxUint256,
        50
      );

    expect(await token["balanceOf(address)"](operator.address)).to.equal(50);
  });

  it("13. Minting increases totalSupply", async function () {
    const { token, owner, user1 } = await loadFixture(
      deployUpgradeableTokenFixture
    );
    expect(await token.totalSupply()).to.equal(0);

    await token.connect(owner).mint(user1.address, 100);
    expect(await token.totalSupply()).to.equal(100);
  });

  it("14. Cannot transfer to zero address", async function () {
    const { token, owner, user1 } = await loadFixture(
      deployUpgradeableTokenFixture
    );
    await token.connect(owner).mint(user1.address, 100);

    await expect(
      token.connect(user1).transfer(ethers.ZeroAddress, 50)
    ).to.be.revertedWith("Transfer to non-approved address is not allowed");
  });

  it("15. isExpired function works correctly", async function () {
    const { token, expirationDays, owner, user1 } = await loadFixture(
      deployUpgradeableTokenFixture
    );
    await token.connect(owner).mint(user1.address, 100);

    const latestTime = await time.latest();
    const tokenClassId = Math.floor(latestTime / 86400);

    expect(await token.isExpired(tokenClassId)).to.be.false;

    await time.increase(expirationDays * 24 * 60 * 60 + 1);
    expect(await token.isExpired(tokenClassId)).to.be.true;
  });

  it("16. Cannot mint with non-minter role", async function () {
    const { token, user1, user2 } = await loadFixture(
      deployUpgradeableTokenFixture
    );
    await expect(token.connect(user1).mint(user2.address, 100))
      .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
      .withArgs(user1.address, MINTER_ROLE);
  });

  it("17. Cannot transfer expired tokens even with sufficient balance", async function () {
    const { token, expirationDays, owner, operator, user1, user2 } =
      await loadFixture(deployUpgradeableTokenFixture);
    await token.grantRole(OPERATOR_ROLE, operator.address);
    await token.connect(owner).mint(user1.address, 100);
    await time.increase(expirationDays * 24 * 60 * 60 + 1);
    await token.connect(owner).mint(user1.address, 50);

    await token.connect(user1).setApprovalForAll(operator.address, true);

    // Try to transfer more than the non-expired balance
    await expect(
      token
        .connect(operator)
        ["safeTransferFrom(address,address,uint256,bytes)"](
          user1.address,
          operator.address,
          51,
          "0x"
        )
    ).to.be.revertedWith("Insufficient non-expired tokens");
  });

  it("18. It is possible to retrieve all asset classes held by an account", async function () {
    const { token, expirationDays, owner, operator, user1, user2 } =
      await loadFixture(deployUpgradeableTokenFixture);
    const baseDay = Math.floor(new Date().getTime() / (86400 * 1000));
    await token.connect(owner).mint(user1.address, 100);
    await ethers.provider.send("evm_increaseTime", [86400]); // Advance 1 day
    await ethers.provider.send("evm_mine", []);
    await token.connect(owner).mint(user1.address, 200);
    await ethers.provider.send("evm_increaseTime", [86400 * 2]); // Advance 2 days
    await ethers.provider.send("evm_mine", []);
    await token.connect(owner).mint(user1.address, 300);
    await ethers.provider.send("evm_increaseTime", [86400 * 3]); // Advance 3 days
    await ethers.provider.send("evm_mine", []);
    await token.connect(owner).mint(user1.address, 400);

    expect(await token["balanceOf(address)"](user1.address)).to.equal(1000);
    expect(await token["userNumTokenClasses"](user1.address)).to.equal(4);
    expect(await token["userTokenClasses"](user1.address, 0)).to.equal(baseDay);
    expect(await token["userTokenClasses"](user1.address, 1)).to.equal(
      baseDay + 1
    );
    expect(await token["userTokenClasses"](user1.address, 2)).to.equal(
      baseDay + 3
    );
    expect(await token["userTokenClasses"](user1.address, 3)).to.equal(
      baseDay + 6
    );
  });
});
