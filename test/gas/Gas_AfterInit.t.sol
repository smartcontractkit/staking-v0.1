// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import '../BaseTest.t.sol';

contract Gas_AfterInit_AsCommunityStaker is BaseTest {
  // =====
  // SETUP
  // =====

  /// @notice Setup BaseTest, give the COMMUNITY_STAKER some LINK,
  /// then "prank" as the COMMUNITY_STAKER (COMMUNITY_STAKER is the msg.sender)
  function setUp() public virtual override {
    BaseTest.setUp();

    // First stake is always going to be the most expensive as storage
    // variables are not yet initialized. We don't care about gas costs
    // during that first call, so we are making it here.
    s_link.transfer(STRANGER, INITIAL_MAX_COMMUNITY_STAKE);
    changePrank(STRANGER);
    s_link.transferAndCall(address(s_staking), INITIAL_MAX_COMMUNITY_STAKE, '');

    changePrank(OWNER);
    s_link.transfer(COMMUNITY_STAKER, INITIAL_MAX_COMMUNITY_STAKE);
    s_staking.setMerkleRoot(keccak256(abi.encode(COMMUNITY_STAKER)));
    changePrank(COMMUNITY_STAKER);

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

  // =========
  // ALERTING
  // =========

  function testCanAlert_False() public view {
    s_staking.canAlert(COMMUNITY_STAKER);
  }

  function testRaiseAlert_Reverts() public {
    vm.expectRevert(IStaking.AccessForbidden.selector);
    s_staking.raiseAlert();
  }

  // =======
  // STAKING
  // =======

  function testStake_Success() public {
    bytes32[] memory proof;
    s_link.transferAndCall(
      address(s_staking),
      INITIAL_MAX_COMMUNITY_STAKE,
      abi.encode(proof)
    );
  }

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

  // =========
  // MIGRATING
  // =========

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

contract Gas_AfterInit_AsOperator is BaseTest {
  // =====
  // SETUP
  // =====

  /// @notice Setup BaseTest, give the OPERATOR some LINK,
  /// then "prank" as the OPERATOR (OPERATOR is the msg.sender)
  function setUp() public virtual override {
    BaseTest.setUp();

    // First stake is always going to be the most expensive as storage
    // variables are not yet initialized. We don't care about gas costs
    // during that first call, so we are making it here.
    s_link.transfer(STRANGER, INITIAL_MAX_COMMUNITY_STAKE);
    changePrank(STRANGER);
    s_link.transferAndCall(address(s_staking), INITIAL_MAX_COMMUNITY_STAKE, '');

    changePrank(OWNER);
    s_link.transfer(OPERATOR, INITIAL_MAX_OPERATOR_STAKE);
    changePrank(OPERATOR);

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

  // =========
  // ALERTING
  // =========

  function testCanAlert_False() public view {
    s_staking.canAlert(OPERATOR);
  }

  function testRaiseAlert_Reverts() public {
    vm.expectRevert(IStaking.AccessForbidden.selector);
    s_staking.raiseAlert();
  }

  // =======
  // STAKING
  // =======

  function testStake_Success() public {
    bytes memory empty;
    s_link.transferAndCall(
      address(s_staking),
      INITIAL_MAX_OPERATOR_STAKE,
      empty
    );
  }

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

  // =========
  // MIGRATING
  // =========

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
