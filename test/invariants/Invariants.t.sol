// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {LinkTokenInterface} from '@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol';
import {AggregatorV3Interface} from '@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol';
import {InvariantsBase} from './InvariantsBase.t.sol';
import {ActorManager} from './helpers/ActorManager.t.sol';
import {ActorCommunityStaker} from './actors/ActorCommunityStaker.t.sol';
import {ActorOperator} from './actors/ActorOperator.t.sol';
import {ActorOwner} from './actors/ActorOwner.t.sol';
import {MockAggregator} from './helpers/MockAggregator.t.sol';
import {TimeWarper} from './helpers/TimeWarper.t.sol';
import {Staking} from '../../contracts/Staking.sol';
import {MockMigrationTarget} from '../../contracts/tests/MockMigrationTarget.sol';

contract Invariants is InvariantsBase {
  // Must be in storage, as they're initialized in setUp().
  // This adds to gas cost when read inside a test function.
  LinkTokenInterface internal s_link;
  MockMigrationTarget internal s_migrationTarget;
  Staking internal s_staking;
  ActorManager private s_actorManager;

  function setUp() public {
    // Perform all actions as OWNER
    changePrank(OWNER);

    // Deploy LinkToken
    // deployCode uses the v0.4 LinkToken artifact in foundry-artifacts/LinkToken.sol
    // to generate a v0.4 LinkToken, wrapped in a v0.8 LinkTokenInterface contract,
    // mimicking the conditions we expect on mainnet
    s_link = LinkTokenInterface(deployCode('LinkToken.sol'));
    // Assert that LinkToken deployment is correct
    assertEq(s_link.totalSupply(), s_link.balanceOf(OWNER));
    excludeContract(address(s_link));

    // Create an aggregator that can be manipulated by the Invariant Warper
    MockAggregator agg = new MockAggregator(1, block.timestamp);
    excludeContract(address(agg));

    // Deploy the staking contracts
    s_staking = new Staking(
      Staking.PoolConstructorParams({
        LINKAddress: s_link,
        monitoredFeed: AggregatorV3Interface(address(agg)),
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
    excludeContract(address(s_staking));

    s_actorManager = new ActorManager(s_staking, s_staking, s_link);
    excludeContract(address(s_actorManager));

    s_actorManager.createAndAddOperators(31);
    s_actorManager.createCommunityStakers(5);

    changePrank(OWNER);
    // Add the s_operators and init the Staking contract
    s_staking.setFeedOperators(s_actorManager.getOperators());
    s_link.approve(address(s_staking), REWARD_AMOUNT);
    s_staking.setMerkleRoot(bytes32('foo'));
    s_staking.start(REWARD_AMOUNT, REWARD_RATE);
    s_staking.setMerkleRoot(bytes32(0));

    ActorOperator actorOperator = new ActorOperator(
      s_actorManager,
      s_staking,
      s_link,
      agg
    );
    bytes4[] memory actorOperatorSelectors = new bytes4[](4);
    actorOperatorSelectors[0] = ActorOperator.stake.selector;
    actorOperatorSelectors[1] = ActorOperator.unstake.selector;
    actorOperatorSelectors[2] = ActorOperator.withdrawRemovedStake.selector;
    actorOperatorSelectors[3] = ActorOperator.raiseAlert.selector;
    addSelectors(address(actorOperator), actorOperatorSelectors);

    ActorCommunityStaker actorCommunityStaker = new ActorCommunityStaker(
      s_actorManager,
      s_staking,
      s_link,
      agg
    );
    bytes4[] memory actorCommunityStakerSelectors = new bytes4[](3);
    actorCommunityStakerSelectors[0] = ActorCommunityStaker.stake.selector;
    actorCommunityStakerSelectors[1] = ActorCommunityStaker.unstake.selector;
    actorCommunityStakerSelectors[2] = ActorCommunityStaker.raiseAlert.selector;
    addSelectors(address(actorCommunityStaker), actorCommunityStakerSelectors);

    // Create an ActorOwner which defines owner functions that forge can call
    // during invariant tests
    ActorOwner actorOwner = new ActorOwner(s_actorManager, s_staking, s_link);
    bytes4[] memory actorOwnerSelectors = new bytes4[](8);
    actorOwnerSelectors[0] = ActorOwner.conclude.selector;
    actorOwnerSelectors[1] = ActorOwner.removeOperators.selector;
    actorOwnerSelectors[2] = ActorOwner.addOperators.selector;
    actorOwnerSelectors[3] = ActorOwner.withdrawUnusedReward.selector;
    actorOwnerSelectors[4] = ActorOwner.changeRewardRate.selector;
    actorOwnerSelectors[5] = ActorOwner.addReward.selector;
    actorOwnerSelectors[6] = ActorOwner.setFeedOperators.selector;
    actorOwnerSelectors[7] = ActorOwner.setPoolConfig.selector;
    addSelectors(address(actorOwner), actorOwnerSelectors);

    TimeWarper timeWaper = new TimeWarper(agg);
    bytes4[] memory timeWaperSelectors = new bytes4[](1);
    timeWaperSelectors[0] = TimeWarper.warp.selector;
    addSelectors(address(timeWaper), timeWaperSelectors);
  }

  /// @notice Ensure that available rewards never exceed the LINK balance
  function invariant_AvailableRewardsAlwaysLessThanLinkBalance() public {
    assertLe(
      s_staking.getAvailableReward(),
      s_link.balanceOf(address(s_staking))
    );
  }

  /// @notice Ensure that fixed + delegation rewards never exceed available rewards
  function invariant_RewardsNeverExceedAvailableRewards() public {
    uint256 baseRewards = s_staking.getEarnedBaseRewards();
    uint256 delegationRewards = s_staking.getEarnedDelegationRewards();
    assertLe(baseRewards + delegationRewards, s_staking.getAvailableReward());
  }

  /// @notice Ensure that the staking amount never exceeds the max pool size
  function invariant_StakingAmountNeverExceedsMaxPoolSize() public {
    assertLe(s_staking.getTotalStakedAmount(), s_staking.getMaxPoolSize());
  }

  /// @notice Ensure that the possible future rewards ((remainingTime * rewardRate) + rewardsSoFar)
  /// do not exceed the available rewards
  function invariant_FutureRewardsNeverExceedAvailableRewards() public {
    (, uint256 endTimestamp) = s_staking.getRewardTimestamps();
    uint256 remainingTime = block.timestamp < endTimestamp
      ? endTimestamp - block.timestamp
      : 0;
    uint256 rewardRate = s_staking.getRewardRate();

    uint256 baseReward = s_staking.getEarnedBaseRewards();
    uint256 delegationReward = s_staking.getEarnedDelegationRewards();

    assertLe(
      (remainingTime * rewardRate) + baseReward + delegationReward,
      s_staking.getAvailableReward()
    );
  }

  /// @notice Ensure that the total rewards issued + total staked amount + future rewards never
  /// exceeds the LINK balance of the staking contract
  function invariant_RewardsPlusTotalStakedNeverExceedsBalance() public {
    uint256 rewardsPlusStaked = s_staking.getTotalStakedAmount() +
      s_staking.getEarnedBaseRewards() +
      s_staking.getEarnedDelegationRewards();
    (, uint256 endTimestamp) = s_staking.getRewardTimestamps();
    if (block.timestamp < endTimestamp) {
      uint256 remainingTime = endTimestamp - block.timestamp;
      uint256 rewardRate = s_staking.getRewardRate();
      rewardsPlusStaked += remainingTime * rewardRate;
    }
    assertLe(rewardsPlusStaked, s_link.balanceOf(address(s_staking)));
  }

  /// @notice Ensure that all getters do not revert at any time after init
  function invariant_GettersDoNotRevert() public view {
    s_staking.getMerkleRoot();
    s_staking.getFeedOperators();
    s_staking.getStake(s_actorManager.getOperators()[0]);
    s_staking.getMaxPoolSize();
    s_staking.getCommunityStakerLimits();
    s_staking.getOperatorLimits();
    s_staking.getRewardTimestamps();
    s_staking.getRewardRate();
    s_staking.getDelegationRateDenominator();
    s_staking.getAvailableReward();
    s_staking.getBaseReward(s_actorManager.getOperators()[0]);
    s_staking.getDelegationReward(s_actorManager.getOperators()[0]);
    s_staking.getTotalDelegatedAmount();
    s_staking.getDelegatesCount();
    s_staking.getTotalStakedAmount();
    s_staking.getTotalRemovedAmount();
    s_staking.getEarnedBaseRewards();
    s_staking.getEarnedDelegationRewards();
    s_staking.getChainlinkToken();
    s_staking.getMonitoredFeed();
    s_staking.getMigrationTarget();
  }
}
