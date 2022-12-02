// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import '../../BaseTest.t.sol';
import '../../../contracts/StakingPoolLib.sol';

contract Staking_FuzzOperatorStaking is BaseTest {
  function setUp() public override {
    BaseTest.setUp();

    // First stake is always going to be the most expensive as storage
    // variables are not yet initialized. We don't care about gas costs
    // during that first call, so we are making it here.
    s_link.transfer(STRANGER, INITIAL_MAX_COMMUNITY_STAKE);
    s_link.transfer(OPERATOR, s_link.balanceOf(OWNER));
    changePrank(STRANGER);
    s_link.transferAndCall(address(s_staking), INITIAL_MAX_COMMUNITY_STAKE, '');

    changePrank(OPERATOR);
  }

  function testStake_SuccessIfWithinLimits(uint256 stakeAmount) public {
    vm.assume(stakeAmount >= INITIAL_MIN_OPERATOR_STAKE);
    vm.assume(stakeAmount <= INITIAL_MAX_OPERATOR_STAKE);
    bytes memory emptyData;
    s_link.transferAndCall(address(s_staking), stakeAmount, emptyData);
    assertEq(s_staking.getStake(OPERATOR) <= INITIAL_MAX_OPERATOR_STAKE, true);
    assertEq(s_staking.getStake(OPERATOR) >= INITIAL_MIN_OPERATOR_STAKE, true);
  }

  function testStake_RevertsIfMoreThanMaxAmount(uint256 stakeAmount) public {
    vm.assume(stakeAmount > INITIAL_MAX_OPERATOR_STAKE);
    vm.assume(stakeAmount < s_link.balanceOf(OPERATOR));

    vm.expectRevert(
      abi.encodeWithSelector(
        StakingPoolLib.ExcessiveStakeAmount.selector,
        INITIAL_MAX_OPERATOR_STAKE
      )
    );
    bytes memory emptyData;
    s_link.transferAndCall(address(s_staking), stakeAmount, emptyData);
  }

  function testStake_RevertsIfLessThanTheMinAmount(uint256 stakeAmount) public {
    vm.assume(stakeAmount > REWARD_PRECISION);
    vm.assume(stakeAmount < INITIAL_MIN_OPERATOR_STAKE);

    vm.expectRevert(
      abi.encodeWithSelector(
        StakingPoolLib.InsufficientStakeAmount.selector,
        INITIAL_MIN_OPERATOR_STAKE
      )
    );
    bytes memory emptyData;
    s_link.transferAndCall(address(s_staking), stakeAmount, emptyData);
  }

  function testStake_RevertsIfLessThanTheRewardPrecision(uint256 stakeAmount)
    public
  {
    vm.assume(stakeAmount > 0);
    vm.assume(stakeAmount < REWARD_PRECISION);

    vm.expectRevert(
      abi.encodeWithSelector(
        StakingPoolLib.InsufficientStakeAmount.selector,
        REWARD_PRECISION
      )
    );
    s_link.transferAndCall(address(s_staking), stakeAmount, '');
  }
}
