// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import '../BaseTest.t.sol';

contract Gas_AfterStake_AsOperator is BaseTest {
  // =====
  // SETUP
  // =====

  /// @notice Setup BaseTest, give the OPERATOR some LINK,
  /// then "prank" as the OPERATOR (OPERATOR is the msg.sender)
  function setUp() public virtual override {
    BaseTest.setUp();

    s_link.transfer(OPERATOR, INITIAL_MAX_OPERATOR_STAKE);
    changePrank(OPERATOR);

    bytes memory empty;
    // Only stake min amount for now
    s_link.transferAndCall(
      address(s_staking),
      INITIAL_MIN_OPERATOR_STAKE,
      empty
    );
  }
}

contract Gas_AfterStake_AsOperator_MigrateReverts is Gas_AfterStake_AsOperator {
  function testMigrate_Reverts() public {
    vm.expectRevert(
      abi.encodeWithSelector(
        StakingPoolLib.InvalidPoolStatus.selector,
        true,
        false
      )
    );
    s_staking.migrate(abi.encode(0));
  }
}

contract Gas_AfterStake_AsOperator_Staking is Gas_AfterStake_AsOperator {
  function testStake_Success() public {
    bytes memory empty;
    s_link.transferAndCall(
      address(s_staking),
      INITIAL_MIN_OPERATOR_STAKE,
      empty
    );
  }
}

contract Gas_AfterStake_AsOperator_UnstakeReverts is Gas_AfterStake_AsOperator {
  function testUnstake_Reverts() public {
    vm.expectRevert(
      abi.encodeWithSelector(
        StakingPoolLib.InvalidPoolStatus.selector,
        true,
        false
      )
    );
    s_staking.unstake();
  }
}

contract Gas_AfterStake_AsOperatorWhenFeedNotDown is Gas_AfterStake_AsOperator {
  function setUp() public virtual override {
    Gas_AfterStake_AsOperator.setUp();
    vm.mockCall(
      address(FEED),
      abi.encodeWithSelector(AggregatorV3Interface.latestRoundData.selector),
      abi.encode(
        uint80(1),
        int256(0),
        uint128(0),
        uint128(block.timestamp),
        uint80(0)
      )
    );
  }

  function testCanAlert_False() public view {
    s_staking.canAlert(OPERATOR);
  }
}

contract Gas_AfterStake_AsOperatorWhenInPriorityPeriod is
  Gas_AfterStake_AsOperator
{
  function setUp() public virtual override {
    Gas_AfterStake_AsOperator.setUp();
    // Have one community staker stake so that NOPs earn some DD rewards
    changePrank(OWNER);
    s_link.transfer(COMMUNITY_STAKER, INITIAL_MIN_COMMUNITY_STAKE);
    s_staking.setMerkleRoot(keccak256(abi.encode(COMMUNITY_STAKER)));
    changePrank(COMMUNITY_STAKER);

    bytes32[] memory proof;
    // Only stake min amount for now
    s_link.transferAndCall(
      address(s_staking),
      INITIAL_MIN_COMMUNITY_STAKE,
      abi.encode(proof)
    );

    // Have all 31 NOPs stake
    bytes memory empty;
    address[] memory operators = _getDefaultOperators();
    for (uint256 i = 1; i < operators.length; i++) {
      changePrank(OWNER);
      address operator = operators[i];
      s_link.transfer(operator, INITIAL_MAX_OPERATOR_STAKE);
      changePrank(operator);
      s_link.transferAndCall(
        address(s_staking),
        INITIAL_MIN_OPERATOR_STAKE,
        empty
      );
    }

    // Make feed go down 2 weeks after all the operators have staked
    // so that operators have some rewards slashed.
    uint256 timeFeedGoesDown = block.timestamp + 14 days;
    vm.warp(timeFeedGoesDown);

    vm.mockCall(
      address(FEED),
      abi.encodeWithSelector(AggregatorV3Interface.latestRoundData.selector),
      abi.encode(
        uint80(1),
        int256(0),
        uint128(0),
        uint128(timeFeedGoesDown),
        uint80(0)
      )
    );
    vm.warp(timeFeedGoesDown + PRIORITY_PERIOD_THRESHOLD_SECONDS + 1);
    changePrank(OPERATOR);
  }

  function testRaiseAlert_Success() public {
    s_staking.raiseAlert();
  }
}
