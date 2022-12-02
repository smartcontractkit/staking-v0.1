// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {Test} from 'forge-std/Test.sol';
import {LinkTokenInterface} from '@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol';
import {AggregatorV3Interface} from '@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol';
import {Constants} from './Constants.t.sol';
import {Staking} from '../../contracts/Staking.sol';
import {MockMigrationTarget} from '../../contracts/tests/MockMigrationTarget.sol';

contract InvariantsBase is Constants, Test {
  // ==========================================================================
  // FORGE HELPERS
  // ==========================================================================

  struct FuzzSelector {
    address addr;
    bytes4[] selectors;
  }

  address[] private s_excludeContracts;
  address[] private s_targetContracts;
  FuzzSelector[] private s_targetSelectors;
  address[] private s_targetSenders;

  constructor() {
    // Set initial sender. This is necessary to circumvent the following issue:
    // https://github.com/foundry-rs/foundry/issues/2963
    // This part can be removed after the above issue is fixed.
    s_targetSenders.push(address(1));
  }

  function excludeContracts() public view returns (address[] memory) {
    return s_excludeContracts;
  }

  function targetContracts() public view returns (address[] memory) {
    return s_targetContracts;
  }

  function targetSelectors() public view returns (FuzzSelector[] memory) {
    return s_targetSelectors;
  }

  function targetSenders() public view returns (address[] memory) {
    return s_targetSenders;
  }

  // To avoid calling auxiliary functions that are inherited but not under test
  // such as forge-std/Test.sol functions.
  function addSelectors(
    address newSelectorAddress,
    bytes4[] memory newSelectors
  ) public {
    s_targetSelectors.push(FuzzSelector(newSelectorAddress, newSelectors));
  }

  function addSender(address newSenderAddress) public {
    s_targetSenders.push(newSenderAddress);
  }

  // Utility function to exclude contracts that shouldn't be called
  function excludeContract(address excludedContractAddress) public {
    s_excludeContracts.push(excludedContractAddress);
  }
}
