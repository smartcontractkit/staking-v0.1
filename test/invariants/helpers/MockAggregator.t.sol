// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {AggregatorV3Interface} from '@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol';

contract MockAggregator is AggregatorV3Interface {
  uint80 private s_roundId;
  uint256 private s_updatedAt;

  constructor(uint80 roundId, uint256 updatedAt) {
    s_roundId = roundId;
    s_updatedAt = updatedAt;
  }

  function setUpdatedAt(uint256 updatedAt) external {
    s_roundId++;
    s_updatedAt = updatedAt;
  }

  function getUpdatedAt() external view returns (uint256) {
    return s_updatedAt;
  }

  function getRoundId() external view returns (uint256) {
    return s_roundId;
  }

  function decimals() external pure returns (uint8) {
    return 0;
  }

  function description() external pure returns (string memory) {
    return 'MockAggregator';
  }

  function version() external pure returns (uint256) {
    return 1;
  }

  // getRoundData and latestRoundData should both raise "No data present"
  // if they do not have data to report, instead of returning unset values
  // which could be misinterpreted as actual reported values.
  function getRoundData(uint80)
    external
    pure
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    )
  {
    return (0, 0, 0, 0, 0);
  }

  function latestRoundData()
    external
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    )
  {
    return (s_roundId, 0, 0, s_updatedAt, 0);
  }
}
