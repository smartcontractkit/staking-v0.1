// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import '../../BaseTest.t.sol';
import '../../../contracts/StakingPoolLib.sol';

contract Staking_FuzzOwnerFunctions is BaseTest {
  // Calculate remaining pool space to determine new operator counts that exceed it
  uint256 internal constant INITIAL_ALLOWED_NEW_OPERATOR_COUNT =
    (INITIAL_MAX_POOL_SIZE / INITIAL_MAX_OPERATOR_STAKE) -
      MIN_INITIAL_OPERATOR_COUNT;
  uint256 internal constant INITIAL_REMAINING_POOL_SPACE =
    INITIAL_MAX_POOL_SIZE -
      (MIN_INITIAL_OPERATOR_COUNT * INITIAL_MAX_OPERATOR_STAKE);
  uint256 internal constant MAX_ALLOWED_OPERATORS = 255;

  function setUp() public override {
    BaseTest.setUp();
  }

  function testAddOperators_SuccessIfWithinMaxPoolSize(uint256 newOperatorCount)
    public
  {
    vm.assume(
      newOperatorCount <= MAX_ALLOWED_OPERATORS - MIN_INITIAL_OPERATOR_COUNT
    );

    address[] memory newOperators = _buildNewOperatorList(newOperatorCount);
    s_staking.addOperators(newOperators);
  }

  function testAddOperators_RevertsIfExceedsMaxPoolSize(
    uint256 newOperatorCount
  ) public {
    vm.assume(newOperatorCount > INITIAL_ALLOWED_NEW_OPERATOR_COUNT);
    vm.assume(newOperatorCount < 10000); // bound test limit to cap memory allocations, otherwise Solidity will overflow

    address[] memory newOperators = _buildNewOperatorList(newOperatorCount);
    uint256 excessRequiredSpace = (newOperatorCount -
      INITIAL_ALLOWED_NEW_OPERATOR_COUNT) * INITIAL_MAX_OPERATOR_STAKE;
    vm.expectRevert(
      abi.encodeWithSelector(
        StakingPoolLib.InsufficientRemainingPoolSpace.selector,
        INITIAL_REMAINING_POOL_SPACE,
        INITIAL_REMAINING_POOL_SPACE + excessRequiredSpace
      )
    );
    s_staking.addOperators(newOperators);
  }

  function _buildNewOperatorList(uint256 newOperatorCount)
    internal
    pure
    returns (address[] memory)
  {
    address[] memory newOperators = new address[](newOperatorCount);
    for (uint256 i; i < newOperatorCount; ++i)
      newOperators[i] = address(uint160(200 + i));
    return newOperators;
  }
}
