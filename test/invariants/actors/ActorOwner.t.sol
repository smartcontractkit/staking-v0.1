// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import 'forge-std/Test.sol';
import {LinkTokenInterface} from '@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol';
import {Constants} from '../Constants.t.sol';
import {ActorManager} from '../helpers/ActorManager.t.sol';
import {Staking} from '../../../contracts/Staking.sol';

contract ActorOwner is Constants, Test {
  ActorManager private immutable i_actorManager;
  Staking private immutable i_staking;
  LinkTokenInterface private immutable i_link;

  constructor(
    ActorManager actorManager,
    Staking staking,
    LinkTokenInterface link
  ) {
    i_actorManager = actorManager;
    i_staking = staking;
    i_link = link;
  }

  function conclude(uint256 seed) public asOwner {
    // Do not attempt to conclude when staking is inactive
    if (!i_staking.isActive()) return _warp(seed);

    (uint256 rewardStartTimestamp, ) = i_staking.getRewardTimestamps();

    // Do not attempt to conclude before 3 months have passed since staking start
    if (rewardStartTimestamp + 90 days > block.timestamp) return _warp(seed);

    i_staking.conclude();
  }

  function addOperators(uint256 seed) public asOwner {
    (uint256 startTimestamp, ) = i_staking.getRewardTimestamps();
    // Do not attempt to conclude when staking is inactive
    if (startTimestamp > 0 && !i_staking.isActive()) return _warp(seed);

    _addOperators(seed);
  }

  function removeOperators(uint256 seed) external asOwner {
    // Do not attempt to removeOperators when staking is inactive
    if (!i_staking.isActive()) return _warp(seed);

    // Add operators instead if there aren't many left
    if (i_actorManager.getOperators().length <= 3) {
      return _addOperators(seed);
    }

    // Remove no more than 3 operators at a time
    uint256 operatorsCount = bound(seed, 1, 3);

    address[] memory operatorsToRemove = new address[](operatorsCount);
    address[] memory feedOperators = i_staking.getFeedOperators();

    // Do not attempt to remove more operators than there are available
    if (feedOperators.length < operatorsCount) return _warp(seed);

    for (uint256 i; i < operatorsCount; i++) {
      address operatorAddress = feedOperators[i];
      operatorsToRemove[i] = operatorAddress;
      i_actorManager.operatorRemove(operatorAddress);
    }

    address[] memory newFeedOperators = new address[](
      feedOperators.length - operatorsCount
    );
    for (uint256 i; i < newFeedOperators.length; i++) {
      newFeedOperators[i] = feedOperators[i + operatorsCount];
    }

    i_staking.setFeedOperators(newFeedOperators);
    i_staking.removeOperators(operatorsToRemove);
  }

  function setFeedOperators(uint256 seed) external asOwner {
    address[] memory activeOperators = i_actorManager.getActiveOperators();

    uint256 operatorsCount = bound(seed, 0, activeOperators.length);

    address[] memory newFeedOperators = new address[](operatorsCount);
    for (uint256 i; i < operatorsCount; i++) {
      newFeedOperators[i] = activeOperators[i];
    }

    i_staking.setFeedOperators(newFeedOperators);
  }

  function withdrawUnusedReward(uint256 seed) external asOwner {
    // Do not attempt to withdrawUnusedReward when staking is active
    if (i_staking.isActive()) return _warp(seed);

    i_staking.withdrawUnusedReward();
  }

  function changeRewardRate(uint256 seed) external asOwner {
    // Do not attempt to changeRewardRate when staking is inactive
    if (!i_staking.isActive()) return;

    i_staking.changeRewardRate(bound(seed, 1, REWARD_RATE * 4));
  }

  function addReward(uint256 seed) external asOwner {
    // Do not attempt to addReward when staking is inactive
    if (!i_staking.isActive()) return;

    uint256 additionalRewardAmount = bound(seed, 0, REWARD_AMOUNT);

    i_link.approve(address(i_staking), additionalRewardAmount);
    i_staking.addReward(additionalRewardAmount);
  }

  function setPoolConfig(uint256 seed) external asOwner {
    // Do not attempt to setPoolConfig when staking is inactive
    if (!i_staking.isActive()) return;

    uint256 maxPoolSize = i_staking.getMaxPoolSize();
    maxPoolSize = bound(seed, maxPoolSize, (maxPoolSize * 11) / 10);

    (, uint256 maxCommunityStakerStakeAmount) = i_staking
      .getCommunityStakerLimits();
    maxCommunityStakerStakeAmount = bound(
      seed,
      maxCommunityStakerStakeAmount,
      (maxCommunityStakerStakeAmount * 11) / 10
    );

    (, uint256 maxOperatorStakeAmount) = i_staking.getOperatorLimits();
    maxOperatorStakeAmount = bound(
      seed,
      maxOperatorStakeAmount,
      (maxOperatorStakeAmount * 11) / 10
    );

    // Add aditional rewards to avoid RewardDurationTooShort errors
    i_link.approve(address(i_staking), REWARD_AMOUNT);
    i_staking.addReward(REWARD_AMOUNT);

    // Set pool config
    i_staking.setPoolConfig(
      maxPoolSize,
      maxCommunityStakerStakeAmount,
      maxOperatorStakeAmount
    );
  }

  // ==========================================================================
  // INTERNALS
  // ==========================================================================

  function _addOperators(uint256 operatorsCount) private {
    // Add no more than 3 operators at a time
    operatorsCount = bound(operatorsCount, 1, 3);

    i_actorManager.createAndAddOperators(operatorsCount);
  }

  function _warp(uint256 seed) private {
    vm.warp(bound(seed, block.timestamp + 1, block.timestamp + 30 days));
  }

  modifier asOwner() {
    changePrank(OWNER);
    _;
  }
}
