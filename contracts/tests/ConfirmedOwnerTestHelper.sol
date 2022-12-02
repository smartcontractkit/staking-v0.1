// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {ConfirmedOwner} from '@chainlink/contracts/src/v0.8/ConfirmedOwner.sol';

contract ConfirmedOwnerTestHelper is ConfirmedOwner {
  event Here();

  constructor(address newOwner) ConfirmedOwner(newOwner) {}

  function modifierOnlyOwner() public onlyOwner {
    emit Here();
  }
}
