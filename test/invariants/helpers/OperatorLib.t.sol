// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {EnumerableSet} from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import {LinkTokenInterface} from '@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol';
import {IStaking} from '../../../contracts/interfaces/IStaking.sol';

library OperatorLib {
  using EnumerableSet for EnumerableSet.AddressSet;

  struct OperatorDetails {
    uint256 index;
    uint256 stake;
    uint256 removedStake;
  }

  struct Operators {
    address[] _addresses;
    address[] _removedAddresses;
    address[] _removedOperatorsWithStake;
    EnumerableSet.AddressSet _addressesWithStake;
    EnumerableSet.AddressSet _active;
    mapping(address => OperatorDetails) _details;
  }

  // ==========================================================================
  // ACTIONS
  // ==========================================================================

  function create(Operators storage operators, address newOperatorAddress)
    public
  {
    operators._addresses.push(newOperatorAddress);
    operators._details[newOperatorAddress].index = operators._addresses.length;
    operators._active.add(newOperatorAddress);
  }

  function remove(Operators storage operators, address operatorAddress) public {
    operators._removedAddresses.push(operatorAddress);
    operators._active.remove(operatorAddress);

    if (operators._addressesWithStake.contains(operatorAddress)) {
      operators._details[operatorAddress].removedStake = operators
        ._details[operatorAddress]
        .stake;
      delete operators._details[operatorAddress].stake;
      operators._removedOperatorsWithStake.push(operatorAddress);
      operators._addressesWithStake.remove(operatorAddress);
    }
  }

  function stake(
    Operators storage operators,
    address operatorAddress,
    uint256 amount
  ) public {
    operators._details[operatorAddress].stake += amount;
    operators._addressesWithStake.add(operatorAddress);
  }

  function unstake(Operators storage operators, address operatorAddress)
    public
  {
    delete operators._details[operatorAddress].stake;
    operators._addressesWithStake.remove(operatorAddress);
  }

  function withdrawRemovedStake(
    Operators storage operators,
    address operatorAddress
  ) public {
    delete operators._details[operatorAddress].removedStake;

    for (uint256 i; i < operators._removedOperatorsWithStake.length; i++) {
      if (operators._removedOperatorsWithStake[i] == operatorAddress) {
        operators._removedOperatorsWithStake[i] = operators
          ._removedOperatorsWithStake[
            operators._removedOperatorsWithStake.length - 1
          ];
        operators._removedOperatorsWithStake.pop();
        break;
      }
    }
  }

  // ==========================================================================
  // VIEW FUNCTIONS
  // ==========================================================================

  function getOperator(Operators storage operators, uint256 index)
    public
    view
    returns (address)
  {
    return operators._addresses[index];
  }

  function getOperators(Operators storage operators)
    public
    view
    returns (address[] memory)
  {
    return operators._addresses;
  }

  function getRemovedOperatorsWithStake(Operators storage operators)
    public
    view
    returns (address[] memory)
  {
    return operators._removedOperatorsWithStake;
  }

  function getOperatorsWithStake(Operators storage operators)
    public
    view
    returns (address[] memory)
  {
    return operators._addressesWithStake.values();
  }

  function getActiveOperators(Operators storage operators)
    public
    view
    returns (address[] memory)
  {
    return operators._active.values();
  }
}
