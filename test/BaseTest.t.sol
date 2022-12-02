// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import 'forge-std/Test.sol';
import '../contracts/Staking.sol';
import '../contracts/tests/MockMigrationTarget.sol';
import '@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol';
import '@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol';

contract BaseTest is Test {
  // =========
  // CONSTANTS
  // =========

  address internal constant OWNER = address(123456789);
  address internal constant STRANGER = address(999999999);

  uint256 internal constant MAX_POOL_SIZE = 25_000_000;
  uint256 internal constant INITIAL_MAX_POOL_SIZE = MAX_POOL_SIZE * 1e18;
  /// Example rate calculation
  /// 60 * 60 * 24 * 365 = 31,536,000 approximate number of seconds in a year
  /// 10^12 is the reward precision
  /// 10^12 * 0.01 / 31,536,000 = 317
  /// constant rate of 1% per year per LINK staked
  uint256 internal constant REWARD_RATE = 317;
  uint256 internal constant REWARD_PRECISION = 1e12;
  uint256 internal constant ONE_MILLION = 1_000_000;
  uint256 internal constant ONE_MONTH = 30 * 24 * 60 * 60;
  uint256 internal constant REWARD_DURATION = ONE_MONTH * 6;
  uint256 internal constant REWARD_AMOUNT =
    MAX_POOL_SIZE * REWARD_RATE * ONE_MILLION * REWARD_DURATION;
  uint256 internal constant MIN_INITIAL_OPERATOR_COUNT = 31;
  uint256 internal constant DELEGATION_RATE_DENOMINATOR = 100;

  uint256 internal constant INITIAL_MIN_OPERATOR_STAKE = 1_000 ether;
  uint256 internal constant INITIAL_MAX_OPERATOR_STAKE = 50_000 ether;

  uint256 internal constant INITIAL_MIN_COMMUNITY_STAKE = 1 ether;
  uint256 internal constant INITIAL_MAX_COMMUNITY_STAKE = 7_000 ether;

  address internal constant OPERATOR = address(100);
  address internal constant OPERATOR_2 = address(101);
  address internal constant COMMUNITY_STAKER = address(200);

  uint256 internal constant MIN_REWARD_DURATION = 30 days;
  uint256 internal constant SLASHABLE_DURATION = 90 days;

  uint256 internal constant PRIORITY_PERIOD_THRESHOLD_SECONDS = 3 hours; // 3 hours
  uint256 internal constant PRIORITY_ROUND_THRESHOLD_SECONDS = 20 minutes; // 20 minutes
  uint256 internal constant REGULAR_PERIOD_THRESHOLD_SECONDS =
    PRIORITY_PERIOD_THRESHOLD_SECONDS + PRIORITY_ROUND_THRESHOLD_SECONDS;
  uint256 internal constant MAX_ALERTING_REWARD_AMOUNT =
    INITIAL_MAX_COMMUNITY_STAKE / 2;

  // We can use constant here to save gas, because nothing in Staking.sol
  // actually checks the size of the code of the feed that gets set
  // and we can mock responses from calls to it with Foundry
  AggregatorV3Interface internal constant FEED =
    AggregatorV3Interface(STRANGER);

  // =======
  // STORAGE
  // =======

  // Must be in storage, as they're initialized in setUp().
  // This adds to gas cost when read inside a test function.
  LinkTokenInterface internal s_link;
  MockMigrationTarget internal s_migrationTarget;
  Staking internal s_staking;

  // =====
  // SETUP
  // =====

  /// @notice Setup the staking contract as OWNER
  function setUp() public virtual {
    // Perform all actions as OWNER
    changePrank(OWNER);

    // Deploy LinkToken
    // deployCode uses the v0.4 LinkToken artifact in foundry-artifacts/LinkToken.sol
    // to generate a v0.4 LinkToken, wrapped in a v0.8 LinkTokenInterface contract,
    // mimicking the conditions we expect on mainnet
    s_link = LinkTokenInterface(deployCode('LinkToken.sol'));
    // Assert that LinkToken deployment is correct
    assertEq(s_link.totalSupply(), s_link.balanceOf(OWNER));

    s_staking = new Staking(
      Staking.PoolConstructorParams({
        LINKAddress: s_link,
        monitoredFeed: FEED,
        initialMaxPoolSize: INITIAL_MAX_POOL_SIZE,
        initialMaxCommunityStakeAmount: INITIAL_MAX_COMMUNITY_STAKE,
        initialMaxOperatorStakeAmount: INITIAL_MAX_OPERATOR_STAKE,
        minCommunityStakeAmount: INITIAL_MIN_COMMUNITY_STAKE,
        minOperatorStakeAmount: INITIAL_MIN_OPERATOR_STAKE,
        priorityPeriodThreshold: PRIORITY_PERIOD_THRESHOLD_SECONDS,
        regularPeriodThreshold: REGULAR_PERIOD_THRESHOLD_SECONDS,
        maxAlertingRewardAmount: MAX_ALERTING_REWARD_AMOUNT,
        minInitialOperatorCount: MIN_INITIAL_OPERATOR_COUNT,
        minRewardDuration: MIN_REWARD_DURATION,
        slashableDuration: SLASHABLE_DURATION,
        delegationRateDenominator: DELEGATION_RATE_DENOMINATOR
      })
    );

    address[] memory operators = _getDefaultOperators();
    s_staking.addOperators(operators);
    s_staking.setFeedOperators(operators);
    s_link.approve(address(s_staking), REWARD_AMOUNT);
    s_staking.setMerkleRoot(bytes32('foo'));
    s_staking.start(REWARD_AMOUNT, REWARD_RATE);
    s_staking.setMerkleRoot(bytes32(''));
  }

  // =======
  // HELPERS
  // =======

  /// @notice 31 unique Operators
  /// @dev We use this instead of storage because high storage
  /// costs interfere with gas measurements of the tests
  function _getDefaultOperators()
    internal
    pure
    returns (address[] memory operators)
  {
    operators = new address[](MIN_INITIAL_OPERATOR_COUNT);
    operators[0] = OPERATOR;
    operators[1] = OPERATOR_2;
    operators[2] = address(102);
    operators[3] = address(103);
    operators[4] = address(104);
    operators[5] = address(105);
    operators[6] = address(106);
    operators[7] = address(107);
    operators[8] = address(108);
    operators[9] = address(109);
    operators[10] = address(110);
    operators[11] = address(111);
    operators[12] = address(112);
    operators[13] = address(113);
    operators[14] = address(114);
    operators[15] = address(115);
    operators[16] = address(116);
    operators[17] = address(117);
    operators[18] = address(118);
    operators[19] = address(119);
    operators[20] = address(120);
    operators[21] = address(121);
    operators[22] = address(122);
    operators[23] = address(123);
    operators[24] = address(124);
    operators[25] = address(125);
    operators[26] = address(126);
    operators[27] = address(127);
    operators[28] = address(128);
    operators[29] = address(129);
    operators[30] = address(130);
  }
}
