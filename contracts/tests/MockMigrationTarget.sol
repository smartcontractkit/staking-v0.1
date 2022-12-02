// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {IERC165} from '@openzeppelin/contracts/interfaces/IERC165.sol';

/// @notice This is a sample migration target contract.
/// @dev The Staking v1 contract will need to implement something similar.
contract MockMigrationTarget is IERC165 {
  mapping(address => uint256) public migratedAmount;
  mapping(address => bytes) public migratedData;

  /// @notice LINK transfer callback function called when transferAndCall is called with this contract as a target.
  /// @param amount Amount of LINK token transferred
  /// @param data Bytes data received, represents migration path
  function onTokenTransfer(
    address, // This will be the staking V0 address
    uint256 amount,
    bytes memory data
  ) public {
    (address sender, bytes memory stakerData) = abi.decode(
      data,
      (address, bytes)
    );
    migratedAmount[sender] = amount;
    migratedData[sender] = stakerData;
  }

  /// @notice This function allows the calling contract to
  /// check if the contract deployed at this address is a valid
  /// LINKTokenReceiver.  A contract is a valid LINKTokenReceiver
  /// if it implements the onTokenTransfer function.
  /// @param interfaceID The ID of the interface to check against
  /// @return bool True if the contract is a valid LINKTokenReceiver.
  function supportsInterface(bytes4 interfaceID) external pure returns (bool) {
    return interfaceID == this.onTokenTransfer.selector;
  }
}
