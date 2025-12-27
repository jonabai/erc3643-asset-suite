// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../../interfaces/IComplianceModule.sol";
import "../../interfaces/ICompliance.sol";
import "../../interfaces/IERC3643.sol";

/**
 * @title MaxBalanceModule
 * @dev Compliance module that enforces maximum balance per holder
 * @notice Prevents any single holder from owning more than a specified amount
 */
contract MaxBalanceModule is IComplianceModule, Ownable {
    /// @dev Mapping from compliance address to max balance limit
    mapping(address => uint256) private _maxBalance;

    /// @dev Emitted when max balance is set
    event MaxBalanceSet(address indexed compliance, uint256 maxBalance);

    constructor() Ownable(msg.sender) {}

    /// @inheritdoc IComplianceModule
    function name() external pure override returns (string memory) {
        return "MaxBalanceModule";
    }

    /**
     * @dev Sets the maximum balance for a compliance contract
     * @param _compliance The compliance contract address
     * @param _max The maximum balance allowed
     */
    function setMaxBalance(address _compliance, uint256 _max) external onlyOwner {
        require(_max > 0, "MaxBalanceModule: max must be greater than 0");
        _maxBalance[_compliance] = _max;
        emit MaxBalanceSet(_compliance, _max);
    }

    /**
     * @dev Gets the maximum balance for a compliance contract
     * @param _compliance The compliance contract address
     * @return The maximum balance
     */
    function getMaxBalance(address _compliance) external view returns (uint256) {
        return _maxBalance[_compliance];
    }

    /// @inheritdoc IComplianceModule
    function moduleCheck(
        address _compliance,
        address /*_from*/,
        address _to,
        uint256 _value
    ) external view override returns (bool) {
        // Skip check for zero address (burning)
        if (_to == address(0)) {
            return true;
        }

        uint256 maxBal = _maxBalance[_compliance];
        // If no max balance is set, allow the transfer
        if (maxBal == 0) {
            return true;
        }

        address token = ICompliance(_compliance).getTokenBound();
        uint256 currentBalance = IERC3643(token).balanceOf(_to);

        return (currentBalance + _value) <= maxBal;
    }

    /// @inheritdoc IComplianceModule
    function moduleTransferAction(
        address /*_compliance*/,
        address /*_from*/,
        address /*_to*/,
        uint256 /*_value*/
    ) external override {
        // No action needed for this module
    }

    /// @inheritdoc IComplianceModule
    function moduleMintAction(address /*_compliance*/, address /*_to*/, uint256 /*_value*/) external override {
        // No action needed for this module
    }

    /// @inheritdoc IComplianceModule
    function moduleBurnAction(address /*_compliance*/, address /*_from*/, uint256 /*_value*/) external override {
        // No action needed for this module
    }

    /// @inheritdoc IComplianceModule
    function isPlugAndPlay(address /*_compliance*/) external pure override returns (bool) {
        return true;
    }
}
