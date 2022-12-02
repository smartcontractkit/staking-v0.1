// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {AggregatorV3Interface} from '@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol';

contract Constants {
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

  uint256 internal constant MIN_REWARD_DURATION = 30 days;
  uint256 internal constant SLASHABLE_DURATION = 90 days;

  uint256 internal constant ALERTING_DOWNTIME_THRESHOLD_SECONDS = 3 hours; // 3 hours
  uint256 internal constant PRIORITY_PERIOD_THRESHOLD_SECONDS = 20 minutes; // 20 minutes
  uint256 internal constant REGULAR_PERIOD_THRESHOLD_SECONDS =
    ALERTING_DOWNTIME_THRESHOLD_SECONDS + PRIORITY_PERIOD_THRESHOLD_SECONDS;
  uint256 internal constant MAX_ALERTING_REWARD_AMOUNT =
    INITIAL_MAX_COMMUNITY_STAKE / 2;

  // We can use constant here to save gas, because nothing in Staking.sol
  // actually checks the size of the code of the feed that gets set
  // and we can mock responses from calls to it with Foundry
  AggregatorV3Interface internal constant FEED =
    AggregatorV3Interface(STRANGER);
}
