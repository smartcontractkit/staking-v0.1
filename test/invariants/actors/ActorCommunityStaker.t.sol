// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import 'forge-std/Test.sol';
import {LinkTokenInterface} from '@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol';
import {Constants} from '../Constants.t.sol';
import {Staking} from '../../../contracts/Staking.sol';
import {ActorManager} from '../helpers/ActorManager.t.sol';
import {MockAggregator} from '../helpers/MockAggregator.t.sol';

contract ActorCommunityStaker is Constants, Test {
  ActorManager private immutable i_actorManager;
  Staking private immutable i_staking;
  LinkTokenInterface private immutable i_link;
  MockAggregator private immutable i_aggregator;

  constructor(
    ActorManager actorManager,
    Staking staking,
    LinkTokenInterface link,
    MockAggregator aggregator
  ) {
    i_actorManager = actorManager;
    i_staking = staking;
    i_link = link;
    i_aggregator = aggregator;
  }

  function stake(uint256 seed) public {
    // If staking is inactive then unstake instead
    if (!i_staking.isActive()) {
      _unstake(seed);
    } else {
      _stake(seed, seed);
    }
  }

  function unstake(uint256 seed) public {
    // If staking is still active then stake instead
    if (i_staking.isActive()) {
      _stake(seed, seed);
    } else {
      _unstake(seed);
    }
  }

  function raiseAlert(uint256 seed) public {
    address communityStakerWithStake = i_actorManager
      .getRandomCommunityStakerAddressWithStake(seed);
    uint256 roundId = i_aggregator.getRoundId();

    if (!i_staking.isActive()) return _unstake(seed);

    // No stakers with stake who can alert
    if (communityStakerWithStake == address(0)) return _stake(seed, seed);

    // REGULAR_PERIOD_THRESHOLD_SECONDS has not passed so alerting is not possible
    if (
      block.timestamp - i_aggregator.getUpdatedAt() <
      REGULAR_PERIOD_THRESHOLD_SECONDS
    ) return _stake(seed, seed);

    if (i_actorManager.getLastAlertRoundId() == i_aggregator.getRoundId())
      return _stake(seed, seed);

    // We need to prank as communityStaker here. If we don't do this, staking
    // contract will be called from the ActorCommunityStaker contract.
    changePrank(communityStakerWithStake);
    i_actorManager.alert(roundId);
    i_staking.raiseAlert();
  }

  // ==========================================================================
  // INTERNALS
  // ==========================================================================

  function _stake(uint256 seed, uint256 amount) private {
    address communityStaker = i_actorManager.getRandomCommunityStakerAddress(
      seed
    );

    // Get min/max stake amounts based on communityStakers status
    // Different limits apply if an communityStaker was removed from staking
    (uint256 minStakeAmount, uint256 maxStakeAmount) = i_staking
      .getCommunityStakerLimits();

    uint256 currentStake = i_staking.getStake(communityStaker);

    if (currentStake > 0) {
      minStakeAmount = REWARD_PRECISION;
      maxStakeAmount = maxStakeAmount - currentStake;
    }

    if (maxStakeAmount < REWARD_PRECISION) return;

    amount = bound(amount, minStakeAmount, maxStakeAmount);
    i_actorManager.communityStakerStake(communityStaker, amount);

    // Fund communityStaker with sufficient LINK to make the transfer
    changePrank(OWNER);
    i_link.transfer(communityStaker, amount);

    // We need to prank as communityStaker here. If we don't do this, staking
    // contract will be called from the ActorCommunityStaker contract.
    changePrank(communityStaker);
    bytes32[] memory proof;
    i_link.transferAndCall(address(i_staking), amount, abi.encode(proof));
  }

  function _unstake(uint256 seed) private {
    address communityStaker = i_actorManager.getRandomCommunityStakerAddress(
      seed
    );

    // Do not attempt to unstake when staker has no stake
    if (i_staking.getStake(communityStaker) == 0) return;
    i_actorManager.communityStakerUnstake(communityStaker);

    // We need to prank as communityStaker here. If we don't do this, staking
    // contract will be called from the ActorCommunityStaker contract.
    changePrank(communityStaker);
    i_staking.unstake();
  }
}
