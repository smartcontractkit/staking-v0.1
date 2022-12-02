// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import 'forge-std/Test.sol';
import {LinkTokenInterface} from '@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol';
import {Constants} from '../Constants.t.sol';
import {Staking} from '../../../contracts/Staking.sol';
import {ActorManager} from '../helpers/ActorManager.t.sol';
import {MockAggregator} from '../helpers/MockAggregator.t.sol';

contract ActorOperator is Constants, Test {
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

  function stake(uint256 seed, uint256 amount) public {
    // If staking is inactive then unstake instead
    if (!i_staking.isActive()) {
      _unstake(seed);
    } else {
      _stake(seed, amount);
    }
  }

  function unstake(uint256 seed, uint256 amount) public {
    // If staking is still active then stake instead
    if (i_staking.isActive()) {
      _stake(seed, amount);
    } else {
      _unstake(seed);
    }
  }

  function withdrawRemovedStake(uint256 seed) external {
    // Do not attempt to withdrawRemovedStake when staking is still active
    if (i_staking.isActive()) return;

    address operator = i_actorManager.getRandomRemovedOperatorAddressWithStake(
      seed
    );

    // Do not attempt to withdrawRemovedStake if no operators have removed stake
    if (operator == address(0)) return;

    i_actorManager.operatorWithdrawRemovedStake(operator);

    // We need to prank as operator here. If we don't do this, staking
    // contract will be called from the ActorOperator contract.
    changePrank(operator);
    i_staking.withdrawRemovedStake();
  }

  function raiseAlert(uint256 seed) public {
    address operatorWithStake = i_actorManager
      .getRandomOperatorAddressWithStake(seed);
    uint256 roundId = i_aggregator.getRoundId();

    if (!i_staking.isActive()) return _unstake(seed);

    // No stakers with stake who can alert
    if (operatorWithStake == address(0)) return _stake(seed, seed);

    // PRIORITY_PERIOD_THRESHOLD_SECONDS has not passed so alerting is not possible
    if (
      block.timestamp - i_aggregator.getUpdatedAt() <
      PRIORITY_PERIOD_THRESHOLD_SECONDS
    ) return _stake(seed, seed);

    if (i_actorManager.getLastAlertRoundId() == i_aggregator.getRoundId())
      return _stake(seed, seed);

    // We need to prank as communityStaker here. If we don't do this, staking
    // contract will be called from the ActorCommunityStaker contract.
    changePrank(operatorWithStake);
    i_actorManager.alert(roundId);
    i_staking.raiseAlert();
  }

  // ==========================================================================
  // INTERNALS
  // ==========================================================================

  function _stake(uint256 seed, uint256 amount) private {
    address operator = i_actorManager.getRandomOperatorAddress(seed);

    // Get min/max stake amounts based on operators status
    // Different limits apply if an operator was removed from staking
    (uint256 minOperatorStakeAmount, uint256 maxOperatorStakeAmount) = i_staking
      .isOperator(operator)
      ? i_staking.getOperatorLimits()
      : i_staking.getCommunityStakerLimits();

    uint256 currentStake = i_staking.getStake(operator);

    if (currentStake > 0) {
      minOperatorStakeAmount = REWARD_PRECISION;
      maxOperatorStakeAmount = maxOperatorStakeAmount - currentStake;
    }

    if (maxOperatorStakeAmount < REWARD_PRECISION) return;

    amount = bound(amount, minOperatorStakeAmount, maxOperatorStakeAmount);
    i_actorManager.operatorStake(operator, amount);

    // Fund operator with sufficient LINK to make the transfer
    changePrank(OWNER);
    i_link.transfer(operator, amount);

    // We need to prank as operator here. If we don't do this, staking
    // contract will be called from the ActorOperator contract.
    changePrank(operator);
    bytes32[] memory proof;
    i_link.transferAndCall(address(i_staking), amount, abi.encode(proof));
  }

  function _unstake(uint256 seed) private {
    address operator = i_actorManager.getRandomOperatorAddress(seed);

    // Do not attempt to unstake when staker has no stake
    if (i_staking.getStake(operator) == 0) return;
    i_actorManager.operatorUnstake(operator);

    // We need to prank as operator here. If we don't do this, staking
    // contract will be called from the ActorOperator contract.
    changePrank(operator);
    i_staking.unstake();
  }
}
