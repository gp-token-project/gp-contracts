// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TokenReceiver.sol";

contract TokenReceiverFactory {
    event TokenReceiverDeployed(
        address indexed owner,
        address tokenReceiver,
        address registeredToken
    );

    // Mapping to track deployed TokenReceivers for each owner
    mapping(address => address[]) public ownerToTokenReceivers;

    function deployTokenReceiver(
        address _tokenAddress
    ) external returns (address) {
        require(_tokenAddress != address(0), "Invalid token address");

        TokenReceiver newReceiver = new TokenReceiver(
            msg.sender,
            _tokenAddress
        );
        ownerToTokenReceivers[msg.sender].push(address(newReceiver));
        emit TokenReceiverDeployed(
            msg.sender,
            address(newReceiver),
            _tokenAddress
        );

        return address(newReceiver);
    }

    function getTokenReceiversByOwner(
        address _owner
    ) external view returns (address[] memory) {
        return ownerToTokenReceivers[_owner];
    }
}
