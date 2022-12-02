// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import '../../BaseTest.t.sol';
import '../../../contracts/StakingPoolLib.sol';

contract Staking_FuzzCommunityStaking is BaseTest {
  function setUp() public override {
    BaseTest.setUp();

    // First stake is always going to be the most expensive as storage
    // variables are not yet initialized. We don't care about gas costs
    // during that first call, so we are making it here.
    s_link.transfer(STRANGER, INITIAL_MAX_COMMUNITY_STAKE);
    s_link.transfer(COMMUNITY_STAKER, s_link.balanceOf(OWNER));
    changePrank(STRANGER);
    s_link.transferAndCall(address(s_staking), INITIAL_MAX_COMMUNITY_STAKE, '');

    changePrank(COMMUNITY_STAKER);
  }

  function testStake_SuccessIfWithinLimits(uint256 stakeAmount) public {
    vm.assume(stakeAmount >= INITIAL_MIN_COMMUNITY_STAKE);
    vm.assume(stakeAmount <= INITIAL_MAX_COMMUNITY_STAKE);
    s_link.transferAndCall(address(s_staking), stakeAmount, '');
    assertEq(
      s_staking.getStake(COMMUNITY_STAKER) <= INITIAL_MAX_COMMUNITY_STAKE,
      true
    );
    assertEq(
      s_staking.getStake(COMMUNITY_STAKER) >= INITIAL_MIN_COMMUNITY_STAKE,
      true
    );
  }

  function testStake_RevertsIfMoreThanMaxAmount(uint256 stakeAmount) public {
    vm.assume(stakeAmount > INITIAL_MAX_COMMUNITY_STAKE);
    vm.assume(stakeAmount < s_link.balanceOf(COMMUNITY_STAKER));

    vm.expectRevert(
      abi.encodeWithSelector(
        StakingPoolLib.ExcessiveStakeAmount.selector,
        INITIAL_MAX_COMMUNITY_STAKE
      )
    );
    s_link.transferAndCall(address(s_staking), stakeAmount, '');
  }

  function testStake_RevertsIfLessThanTheMinAmount(uint256 stakeAmount) public {
    vm.assume(stakeAmount > REWARD_PRECISION);
    vm.assume(stakeAmount < INITIAL_MIN_COMMUNITY_STAKE);

    vm.expectRevert(
      abi.encodeWithSelector(
        StakingPoolLib.InsufficientStakeAmount.selector,
        INITIAL_MIN_COMMUNITY_STAKE
      )
    );
    s_link.transferAndCall(address(s_staking), stakeAmount, '');
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

contract Staking_FuzzCommunityStakerStakeMaxPoolSize is BaseTest {
  address constant STAKER = address(201);

  function setUp() public override {
    BaseTest.setUp();
    s_staking.setMerkleRoot('');

    uint256 customMaxOperatorStake = INITIAL_MAX_OPERATOR_STAKE * 16;

    uint256 communityStakerMaxStakeAmount = INITIAL_MAX_POOL_SIZE -
      customMaxOperatorStake *
      MIN_INITIAL_OPERATOR_COUNT;

    s_staking.setPoolConfig(
      INITIAL_MAX_POOL_SIZE,
      communityStakerMaxStakeAmount,
      customMaxOperatorStake
    );

    // Fill up pool
    changePrank(OWNER);
    s_link.transfer(COMMUNITY_STAKER, communityStakerMaxStakeAmount);
    changePrank(COMMUNITY_STAKER);
    s_link.transferAndCall(
      address(s_staking),
      communityStakerMaxStakeAmount,
      ''
    );

    changePrank(OWNER);
    s_link.transfer(STAKER, INITIAL_MAX_COMMUNITY_STAKE);
    changePrank(STAKER);
  }

  function testStake_CommunityStakerRevertsIfMoreThanMaxPoolSize(
    uint256 stakeAmount
  ) public {
    vm.assume(stakeAmount >= INITIAL_MIN_COMMUNITY_STAKE);
    vm.assume(stakeAmount < INITIAL_MAX_COMMUNITY_STAKE);

    vm.expectRevert(
      abi.encodeWithSelector(StakingPoolLib.ExcessiveStakeAmount.selector, 0)
    );
    s_link.transferAndCall(address(s_staking), stakeAmount, '');
  }
}
