// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

contract ExpiringToken is
    Initializable,
    ERC1155Upgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    IERC20
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public constant SECONDS_PER_DAY = 86400;
    uint256 public expirationPeriodDays;

    mapping(address => uint256[]) public userTokenClasses;
    mapping(address => uint256) public userNumTokenClasses;

    // ERC20 compatibility
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory _name,
        string memory _symbol,
        string memory _uri,
        uint256 _expirationPeriodDays
    ) public initializer {
        __ERC1155_init(_uri);
        __AccessControl_init();
        __UUPSUpgradeable_init();

        name = _name;
        symbol = _symbol;
        expirationPeriodDays = _expirationPeriodDays;
        _setURI(_uri);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
    }

    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        uint256 tokenClassId = block.timestamp / SECONDS_PER_DAY;

        if (!_tokenClassExists(to, tokenClassId)) {
            userTokenClasses[to].push(tokenClassId);
            userNumTokenClasses[to] += 1;
        }

        _mint(to, tokenClassId, amount, "");
        _balances[to] += amount;
        _totalSupply += amount;

        emit Transfer(address(0), to, amount);
    }

    function _tokenClassExists(
        address account,
        uint256 tokenClassId
    ) internal view returns (bool) {
        for (uint256 i = 0; i < userTokenClasses[account].length; i++) {
            if (userTokenClasses[account][i] == tokenClassId) {
                return true;
            }
        }
        return false;
    }

    function balanceOf(
        address account
    ) public view override(IERC20) returns (uint256) {
        return balance(account);
    }

    function balance(address account) public view returns (uint256) {
        uint256 totalBalance = 0;
        uint256 currentDay = block.timestamp / SECONDS_PER_DAY;
        for (uint256 i = 0; i < userTokenClasses[account].length; i++) {
            uint256 tokenClassId = userTokenClasses[account][i];
            if (currentDay < tokenClassId + expirationPeriodDays) {
                totalBalance += super.balanceOf(account, tokenClassId);
            }
        }
        return totalBalance;
    }

    function expiredTokenBalance(
        address account
    ) public view returns (uint256) {
        uint256 expiredBalance = 0;
        uint256 currentDay = block.timestamp / SECONDS_PER_DAY;
        for (uint256 i = 0; i < userTokenClasses[account].length; i++) {
            uint256 tokenClassId = userTokenClasses[account][i];
            if (currentDay >= tokenClassId + expirationPeriodDays) {
                expiredBalance += super.balanceOf(account, tokenClassId);
            }
        }
        return expiredBalance;
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 amount,
        bytes memory // data
    ) public virtual returns (bool) {
        uint256 remainingAmount = amount;
        uint256[] memory tokenClassIds = userTokenClasses[from];

        for (
            uint256 i = 0;
            i < tokenClassIds.length && remainingAmount > 0;
            i++
        ) {
            uint256 tokenClassId = tokenClassIds[i];
            if (
                block.timestamp / SECONDS_PER_DAY <
                tokenClassId + expirationPeriodDays
            ) {
                uint256 bal = super.balanceOf(from, tokenClassId);
                uint256 transferAmount = remainingAmount > bal
                    ? bal
                    : remainingAmount;

                this.safeTransferFrom(
                    from,
                    to,
                    tokenClassId,
                    transferAmount,
                    ""
                );

                remainingAmount -= transferAmount;
            }
        }

        require(remainingAmount == 0, "Insufficient non-expired tokens");
        return true;
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public virtual override nonReentrant {
        require(
            block.timestamp / SECONDS_PER_DAY < id + expirationPeriodDays,
            "tokens have already expired"
        );

        uint256[] memory ids = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        ids[0] = id;
        amounts[0] = amount;

        // Pre-transfer check
        if (from != address(0)) {
            require(
                hasRole(OPERATOR_ROLE, to),
                "Transfer to non-approved address is not allowed"
            );
        }
        // Perform the transfer with ERC1155's internal method - the main reason for this
        // is to have the usual events and hooks associated to ERC1155 contracts
        super._safeTransferFrom(from, to, id, amount, data);

        // Update user token classes
        if (super.balanceOf(from, id) == 0) {
            _removeTokenClassFromUser(from, id);
        }
        if (!_tokenClassExists(to, id)) {
            userTokenClasses[to].push(id);
        }
    }

    function transfer(
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        return this.safeTransferFrom(msg.sender, to, amount, "");
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        return this.safeTransferFrom(from, to, amount, "");
    }

    function _removeTokenClassFromUser(
        address user,
        uint256 tokenClassId
    ) internal {
        for (uint256 i = 0; i < userTokenClasses[user].length; i++) {
            if (userTokenClasses[user][i] == tokenClassId) {
                userTokenClasses[user][i] = userTokenClasses[user][
                    userTokenClasses[user].length - 1
                ];
                userTokenClasses[user].pop();
                break;
            }
        }
    }

    function isExpired(uint256 tokenClassId) public view returns (bool) {
        return
            block.timestamp / SECONDS_PER_DAY >=
            tokenClassId + expirationPeriodDays;
    }

    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    function allowance(
        address owner,
        address spender
    ) public view virtual override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(
        address spender,
        uint256 amount
    ) public virtual override returns (bool) {
        address owner = msg.sender;
        _approve(owner, spender, amount);
        return true;
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        require(owner != address(0), "approve from the zero address");
        require(spender != address(0), "approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        virtual
        override(ERC1155Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        if (interfaceId == type(IERC20).interfaceId) {
            return true;
        }
        // Intentionally do NOT publicize the other interfaces, so that this gets seen as an ERC20 token by most wallet softwares
        // return super.supportsInterface(interfaceId);
        return false;
    }

    // No specific logic for now - but this interface is required with UUPS proxies
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {}
}
