// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import 'forge-std/Test.sol';
import {Constants} from '../Constants.t.sol';
import {MockAggregator} from './MockAggregator.t.sol';

contract TimeWarper is Constants, Test {
  MockAggregator private s_aggregator;

  constructor(MockAggregator aggregator) {
    s_aggregator = aggregator;
  }

  function warp(bool warpAggregator, uint256 amount) external {
    if (warpAggregator) {
      // Warp the aggregator timestamp backwards between 0 and 2 days
      s_aggregator.setUpdatedAt(
        block.timestamp -
          bound(amount, REGULAR_PERIOD_THRESHOLD_SECONDS + 1, 2 days)
      );
    } else {
      vm.warp(bound(amount, block.timestamp + 1, block.timestamp + 30 days));
    }
  }
}
