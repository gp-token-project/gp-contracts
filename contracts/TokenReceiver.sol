// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ExpiringToken.sol";

contract TokenReceiver is ERC1155Holder, Ownable {
    // Only one ExpiringToken instance may be registered
    ExpiringToken public registeredToken;

    event TokensReceived(
        address indexed sender,
        uint256 amount,
        uint256 tokenClassId,
        uint256 timestamp
    );

    constructor(address _owner, address _registeredToken) Ownable(_owner) {
        require(_registeredToken != address(0), "Invalid token address");
        require(_owner != address(0), "Invalid owner address");
        registeredToken = ExpiringToken(_registeredToken);
    }

    /**
     * @dev Override of ERC1155's onERC1155Received function
     * Only emits events if the tokens are from the registered token contract
     */
    function onERC1155Received(
        address, // operator
        address from,
        uint256 id,
        uint256 amount,
        bytes memory
    ) public virtual override returns (bytes4) {
        // Only emit event if the tokens are from the registered token contract
        if (msg.sender == address(registeredToken)) {
            emit TokensReceived(from, amount, id, block.timestamp);
        }

        return this.onERC1155Received.selector;
    }

    /**
     * @dev Override of ERC1155's onERC1155BatchReceived function
     * Only emits events if the tokens are from the registered token contract
     */
    function onERC1155BatchReceived(
        address, // operator
        address from,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory
    ) public virtual override returns (bytes4) {
        // Only emit events if the tokens are from the registered token contract
        if (msg.sender == address(registeredToken)) {
            for (uint256 i = 0; i < ids.length; i++) {
                emit TokensReceived(from, amounts[i], ids[i], block.timestamp);
            }
        }

        return this.onERC1155BatchReceived.selector;
    }

    /**
     * @dev Allows the owner to update the registered token address
     * @param newTokenAddress The address of the new token contract
     */
    function updateRegisteredToken(address newTokenAddress) external onlyOwner {
        require(newTokenAddress != address(0), "Invalid token address");
        registeredToken = ExpiringToken(newTokenAddress);
    }

    /**
     * @dev Returns the current balance of non-expired tokens
     */
    function currentBalance() external view returns (uint256) {
        return registeredToken.balance(address(this));
    }

    /**
     * @dev Returns the balance of expired tokens
     */
    function expiredBalance() external view returns (uint256) {
        return registeredToken.expiredTokenBalance(address(this));
    }
}
