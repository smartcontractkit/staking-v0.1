// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import '../../../contracts/tests/ConfirmedOwnerTestHelper.sol';

contract ConfirmedOwnerFuzzTest {
  address internal _echidna_caller = 0x00a329c0648769A73afAc7F9381E08FB43dBEA72;

  ConfirmedOwnerTestHelper c = new ConfirmedOwnerTestHelper(_echidna_caller);

  function echidna_test_constant_coordinator() public view returns (bool) {
    return c.owner() == _echidna_caller;
  }
}
