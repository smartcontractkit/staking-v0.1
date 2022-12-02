// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import '../../BaseTest.t.sol';
import '../../../contracts/StakingPoolLib.sol';

contract Staking_RoundingErrors is BaseTest {
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

  function test_DelegationRateRounding() public {
    bytes32[] memory proof;
    s_link.transfer(OPERATOR, INITIAL_MIN_OPERATOR_STAKE);
    s_link.transfer(OPERATOR_2, INITIAL_MIN_OPERATOR_STAKE);
    s_link.transfer(COMMUNITY_STAKER, INITIAL_MIN_OPERATOR_STAKE);

    changePrank(OPERATOR);
    s_link.transferAndCall(
      address(s_staking),
      INITIAL_MIN_OPERATOR_STAKE,
      abi.encode(proof)
    );

    changePrank(OPERATOR_2);
    s_link.transferAndCall(
      address(s_staking),
      INITIAL_MIN_OPERATOR_STAKE,
      abi.encode(proof)
    );

    changePrank(COMMUNITY_STAKER);
    s_link.transferAndCall(
      address(s_staking),
      INITIAL_MIN_COMMUNITY_STAKE,
      abi.encode(proof)
    );

    changePrank(OWNER);
    uint256 huge_reward = s_link.balanceOf(OWNER);
    s_link.approve(address(s_staking), huge_reward);
    s_staking.addReward(huge_reward);

    uint256 addmore_amount = 1e12 + 10;
    changePrank(COMMUNITY_STAKER);
    for (uint256 i = 0; i < 10; i++) {
      s_link.transferAndCall(
        address(s_staking),
        addmore_amount,
        abi.encode(proof)
      );
    }

    changePrank(OWNER);
    s_staking.conclude();
  }
}
