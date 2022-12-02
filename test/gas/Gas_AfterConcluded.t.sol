// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import '../BaseTest.t.sol';

contract Gas_AfterConcluded_AsCommunityStaker is BaseTest {
  // =====
  // SETUP
  // =====

  function setUp() public virtual override {
    BaseTest.setUp();

    s_link.transfer(COMMUNITY_STAKER, INITIAL_MAX_OPERATOR_STAKE);
    s_staking.setMerkleRoot(keccak256(abi.encode(COMMUNITY_STAKER)));
    changePrank(COMMUNITY_STAKER);

    bytes32[] memory proof;
    // Only stake min amount for now
    s_link.transferAndCall(
      address(s_staking),
      INITIAL_MIN_COMMUNITY_STAKE,
      abi.encode(proof)
    );

    // Conclude
    vm.warp(block.timestamp + ONE_MONTH + 1);
    changePrank(OWNER);
    s_staking.conclude();

    // Set the migration target
    s_migrationTarget = new MockMigrationTarget();
    s_staking.proposeMigrationTarget(address(s_migrationTarget));
    vm.warp(block.timestamp + 7 days);
    s_staking.acceptMigrationTarget();

    changePrank(COMMUNITY_STAKER);
  }

  // =======
  // STAKING
  // =======

  function testUnstake_Success() public {
    s_staking.unstake();
  }

  // =========
  // MIGRATING
  // =========

  function testMigrate_Success() public {
    s_staking.migrate(abi.encode(0));
  }
}

contract Gas_AfterConcluded_AsOperator is BaseTest {
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

    // Conclude
    vm.warp(block.timestamp + ONE_MONTH + 1);
    changePrank(OWNER);
    s_staking.conclude();

    // Set the migration target
    s_migrationTarget = new MockMigrationTarget();
    s_staking.proposeMigrationTarget(address(s_migrationTarget));
    vm.warp(block.timestamp + 7 days);
    s_staking.acceptMigrationTarget();

    changePrank(OPERATOR);
  }

  // =======
  // STAKING
  // =======

  function testUnstake_Success() public {
    s_staking.unstake();
  }

  // =========
  // MIGRATING
  // =========

  function testMigrate_Success() public {
    s_staking.migrate(abi.encode(0));
  }
}
