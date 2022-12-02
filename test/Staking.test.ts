import { expect } from 'chai';
import { publicAbi } from './utils/helpers';
import { shouldBehaveLikeConfirmedOwner } from './ConfirmedOwner.behaviour';
import { Signers } from '../types';
import hre, { ethers } from 'hardhat';
import {
  PRIORITY_PERIOD_THRESHOLD_SECONDS,
  GENERAL_STAKE_AMOUNT,
  INITIAL_MAX_OPERATOR_STAKE,
  INITIAL_MAX_POOL_SIZE,
  INITIAL_MAX_COMMUNITY_STAKE,
  INITIAL_MIN_OPERATOR_STAKE,
  INITIAL_MIN_COMMUNITY_STAKE,
  INITIAL_START_TIMESTAMP,
  MIN_INITIAL_OPERATOR_COUNT,
  MIN_REWARD_DURATION,
  MAX_ALERTING_REWARD_AMOUNT,
  REGULAR_PERIOD_THRESHOLD_SECONDS,
  REWARD_AMOUNT,
  DELEGATION_RATE_DENOMINATOR,
  REWARD_RATE,
  setupContracts,
  SLASHABLE_DURATION,
} from './utils/setup';
import { getDelegationReward } from './utils/rewards';
import { LinkToken, Staking, StakingPoolLib, Staking__factory } from '../typechain';
import { MockContract } from 'ethereum-waffle';
import { getEncodedMerkleProof } from './utils/merkleTree';
import MerkleTree from 'merkletreejs';
import { EMPTY_MERKLE_ROOT } from './utils/mockdata';

describe('Staking', function () {
  let signers: Signers;
  let staking: Staking;
  let link: LinkToken;
  let stakingPoolLib: StakingPoolLib;
  let feed: MockContract;
  let merkleTree: MerkleTree;
  let proof: string;

  beforeEach(async function () {
    const config = await setupContracts();
    signers = config.signers;
    staking = config.staking;
    link = config.link;
    stakingPoolLib = config.stakingPoolLib;
    feed = config.feed;
    merkleTree = config.merkleTree;
    proof = getEncodedMerkleProof(config.merkleTree, signers.communityStaker.address);
  });

  it('has a limited public interface [ @skip-coverage ]', async function () {
    publicAbi(staking, [
      'addOperators',
      'getOperatorLimits',
      'isActive',
      'getMaxPoolSize',
      'getRewardRate',
      'getRewardTimestamps',
      'getAvailableReward',
      'getStake',
      'getCommunityStakerLimits',
      'getMonitoredFeed',
      'getDelegationRateDenominator',
      'getDelegationReward',
      'getBaseReward',
      'getEarnedDelegationRewards',
      'getEarnedBaseRewards',
      'getTotalDelegatedAmount',
      'getDelegatesCount',
      'getTotalStakedAmount',
      'getTotalCommunityStakedAmount',
      'getTotalRemovedAmount',
      'getFeedOperators',
      'setFeedOperators',
      'start',
      'conclude',
      'isOperator',
      'removeOperators',
      'setPoolConfig',
      'unstake',
      'withdrawRemovedStake',
      'changeRewardRate',
      'addReward',
      'withdrawUnusedReward',
      'getMigrationTarget',
      'proposeMigrationTarget',
      'acceptMigrationTarget',
      'migrate',
      'getChainlinkToken',
      'onTokenTransfer',
      // IMerkleAccessController functions
      'hasAccess',
      'getMerkleRoot',
      'setMerkleRoot',
      // AlertsController functions
      'canAlert',
      'raiseAlert',
      // ConfirmedOwner functions
      'acceptOwnership',
      'owner',
      'transferOwnership',
      // TypeAndVersion function
      'typeAndVersion',
      'emergencyPause',
      'emergencyUnpause',
      'isPaused',
      'paused',
    ]);
  });

  describe('when the contract is first initialized', function () {
    it('reverts when the monitored feed is zero', async function () {
      await expect(
        new Staking__factory(signers.owner).deploy({
          LINKAddress: link.address,
          monitoredFeed: ethers.constants.AddressZero,
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
          delegationRateDenominator: DELEGATION_RATE_DENOMINATOR,
        }),
      ).to.be.revertedWith('InvalidZeroAddress()');
    });

    it('reverts when LINK address is zero', async function () {
      await expect(
        new Staking__factory(signers.owner).deploy({
          LINKAddress: ethers.constants.AddressZero,
          monitoredFeed: feed.address,
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
          delegationRateDenominator: DELEGATION_RATE_DENOMINATOR,
        }),
      ).to.be.revertedWith('InvalidZeroAddress()');
    });

    it('reverts when delegation rate is zero', async function () {
      await expect(
        new Staking__factory(signers.owner).deploy({
          LINKAddress: link.address,
          monitoredFeed: feed.address,
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
          delegationRateDenominator: 0,
        }),
      ).to.be.revertedWith('InvalidDelegationRate()');
    });

    it('reverts when REWARD_PRECISION is not a multiple of the delegation rate denominator', async function () {
      await expect(
        new Staking__factory(signers.owner).deploy({
          LINKAddress: link.address,
          monitoredFeed: feed.address,
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
          delegationRateDenominator: 19,
        }),
      ).to.be.revertedWith('InvalidDelegationRate()');
    });

    it('reverts when regular period threshold is <= priority period threshold', async function () {
      await expect(
        new Staking__factory(signers.owner).deploy({
          LINKAddress: link.address,
          monitoredFeed: feed.address,
          initialMaxPoolSize: INITIAL_MAX_POOL_SIZE,
          initialMaxCommunityStakeAmount: INITIAL_MAX_COMMUNITY_STAKE,
          initialMaxOperatorStakeAmount: INITIAL_MAX_OPERATOR_STAKE,
          minCommunityStakeAmount: INITIAL_MIN_COMMUNITY_STAKE,
          minOperatorStakeAmount: INITIAL_MIN_OPERATOR_STAKE,
          priorityPeriodThreshold: REGULAR_PERIOD_THRESHOLD_SECONDS,
          regularPeriodThreshold: REGULAR_PERIOD_THRESHOLD_SECONDS,
          maxAlertingRewardAmount: MAX_ALERTING_REWARD_AMOUNT,
          minInitialOperatorCount: MIN_INITIAL_OPERATOR_COUNT,
          minRewardDuration: MIN_REWARD_DURATION,
          slashableDuration: SLASHABLE_DURATION,
          delegationRateDenominator: DELEGATION_RATE_DENOMINATOR,
        }),
      ).to.be.revertedWith('InvalidRegularPeriodThreshold()');
    });

    it('reverts when min operator stake amount 0', async function () {
      await expect(
        new Staking__factory(signers.owner).deploy({
          LINKAddress: link.address,
          monitoredFeed: feed.address,
          initialMaxPoolSize: INITIAL_MAX_POOL_SIZE,
          initialMaxCommunityStakeAmount: INITIAL_MAX_COMMUNITY_STAKE,
          initialMaxOperatorStakeAmount: INITIAL_MAX_OPERATOR_STAKE,
          minCommunityStakeAmount: INITIAL_MIN_COMMUNITY_STAKE,
          minOperatorStakeAmount: 0,
          priorityPeriodThreshold: PRIORITY_PERIOD_THRESHOLD_SECONDS,
          regularPeriodThreshold: REGULAR_PERIOD_THRESHOLD_SECONDS,
          maxAlertingRewardAmount: MAX_ALERTING_REWARD_AMOUNT,
          minInitialOperatorCount: MIN_INITIAL_OPERATOR_COUNT,
          minRewardDuration: MIN_REWARD_DURATION,
          slashableDuration: SLASHABLE_DURATION,
          delegationRateDenominator: DELEGATION_RATE_DENOMINATOR,
        }),
      ).to.be.revertedWith('InvalidMinOperatorStakeAmount()');
    });

    it('reverts when min operator stake amount is more than initial max operator stake amount', async function () {
      await expect(
        new Staking__factory(signers.owner).deploy({
          LINKAddress: link.address,
          monitoredFeed: feed.address,
          initialMaxPoolSize: INITIAL_MAX_POOL_SIZE,
          initialMaxCommunityStakeAmount: INITIAL_MAX_COMMUNITY_STAKE,
          initialMaxOperatorStakeAmount: INITIAL_MAX_OPERATOR_STAKE,
          minCommunityStakeAmount: INITIAL_MIN_COMMUNITY_STAKE,
          minOperatorStakeAmount: INITIAL_MAX_OPERATOR_STAKE.add(1),
          priorityPeriodThreshold: PRIORITY_PERIOD_THRESHOLD_SECONDS,
          regularPeriodThreshold: REGULAR_PERIOD_THRESHOLD_SECONDS,
          maxAlertingRewardAmount: MAX_ALERTING_REWARD_AMOUNT,
          minInitialOperatorCount: MIN_INITIAL_OPERATOR_COUNT,
          minRewardDuration: MIN_REWARD_DURATION,
          slashableDuration: SLASHABLE_DURATION,
          delegationRateDenominator: DELEGATION_RATE_DENOMINATOR,
        }),
      ).to.be.revertedWith('InvalidMinOperatorStakeAmount()');
    });

    it('reverts when min operator stake amount is more than initial max operator stake amount', async function () {
      await expect(
        new Staking__factory(signers.owner).deploy({
          LINKAddress: link.address,
          monitoredFeed: feed.address,
          initialMaxPoolSize: INITIAL_MAX_POOL_SIZE,
          initialMaxCommunityStakeAmount: INITIAL_MAX_COMMUNITY_STAKE,
          initialMaxOperatorStakeAmount: INITIAL_MAX_OPERATOR_STAKE,
          minCommunityStakeAmount: INITIAL_MAX_COMMUNITY_STAKE.add(1),
          minOperatorStakeAmount: INITIAL_MIN_OPERATOR_STAKE,
          priorityPeriodThreshold: PRIORITY_PERIOD_THRESHOLD_SECONDS,
          regularPeriodThreshold: REGULAR_PERIOD_THRESHOLD_SECONDS,
          maxAlertingRewardAmount: MAX_ALERTING_REWARD_AMOUNT,
          minInitialOperatorCount: MIN_INITIAL_OPERATOR_COUNT,
          minRewardDuration: MIN_REWARD_DURATION,
          slashableDuration: SLASHABLE_DURATION,
          delegationRateDenominator: DELEGATION_RATE_DENOMINATOR,
        }),
      ).to.be.revertedWith('InvalidMinCommunityStakeAmount()');
    });

    it('reverts when max alerting amount is more than max operator stake amount', async function () {
      await expect(
        new Staking__factory(signers.owner).deploy({
          LINKAddress: link.address,
          monitoredFeed: feed.address,
          initialMaxPoolSize: INITIAL_MAX_POOL_SIZE,
          initialMaxCommunityStakeAmount: INITIAL_MAX_COMMUNITY_STAKE,
          initialMaxOperatorStakeAmount: INITIAL_MAX_OPERATOR_STAKE,
          minCommunityStakeAmount: INITIAL_MIN_COMMUNITY_STAKE,
          minOperatorStakeAmount: INITIAL_MIN_OPERATOR_STAKE,
          priorityPeriodThreshold: PRIORITY_PERIOD_THRESHOLD_SECONDS,
          regularPeriodThreshold: REGULAR_PERIOD_THRESHOLD_SECONDS,
          maxAlertingRewardAmount: INITIAL_MAX_OPERATOR_STAKE.add(1),
          minInitialOperatorCount: MIN_INITIAL_OPERATOR_COUNT,
          minRewardDuration: MIN_REWARD_DURATION,
          slashableDuration: SLASHABLE_DURATION,
          delegationRateDenominator: DELEGATION_RATE_DENOMINATOR,
        }),
      ).to.be.revertedWith('InvalidMaxAlertingRewardAmount()');
    });

    it('the staking pool is closed', async function () {
      expect(await staking.isActive()).to.equal(false);
    });

    it('#getChainlinkToken returns the LINK address', async function () {
      expect(await staking.getChainlinkToken()).to.equal(link.address);
    });

    it('sets the correct monitored feed address', async function () {
      expect(await staking.getMonitoredFeed()).to.equal(feed.address);
    });

    it('sets initial values correctly and emits events ', async function () {
      const stk = await new Staking__factory(signers.owner).deploy({
        LINKAddress: link.address,
        monitoredFeed: feed.address,
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
        delegationRateDenominator: DELEGATION_RATE_DENOMINATOR,
      });
      const tx = stk.deployTransaction;
      await expect(tx).to.emit(stakingPoolLib.attach(stk.address), 'PoolSizeIncreased').withArgs(INITIAL_MAX_POOL_SIZE);
      await expect(tx)
        .to.emit(stakingPoolLib.attach(stk.address), 'MaxCommunityStakeAmountIncreased')
        .withArgs(INITIAL_MAX_COMMUNITY_STAKE);
      await expect(tx)
        .to.emit(stakingPoolLib.attach(stk.address), 'MaxOperatorStakeAmountIncreased')
        .withArgs(INITIAL_MAX_OPERATOR_STAKE);

      const newCommunityStakerLimits = await staking.connect(signers.other).getCommunityStakerLimits();
      const newOperatorLimits = await staking.connect(signers.other).getOperatorLimits();

      expect(await staking.connect(signers.other).getMaxPoolSize()).to.equal(INITIAL_MAX_POOL_SIZE);
      expect(newCommunityStakerLimits[0]).to.equal(INITIAL_MIN_COMMUNITY_STAKE);
      expect(newCommunityStakerLimits[1]).to.equal(INITIAL_MAX_COMMUNITY_STAKE);
      expect(newOperatorLimits[0]).to.equal(INITIAL_MIN_OPERATOR_STAKE);
      expect(newOperatorLimits[1]).to.equal(INITIAL_MAX_OPERATOR_STAKE);
    });
  });

  describe('#isActive', function () {
    describe('when pool is started', function () {
      beforeEach(async function () {
        await Promise.all([
          staking.connect(signers.owner).addOperators(signers.defaultOperators),
          link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT),
        ]);
        await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);
      });

      it('returns true', async function () {
        expect(await staking.isActive()).to.equal(true);
      });

      describe('when staking concludes', function () {
        beforeEach(async function () {
          await staking.connect(signers.owner).conclude();
        });

        it('returns false', async function () {
          expect(await staking.isActive()).to.equal(false);
        });
      });

      describe('when reward is expired', function () {
        beforeEach(async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP]);
          await hre.network.provider.send('evm_mine');
        });

        it('returns false', async function () {
          expect(await staking.isActive()).to.equal(false);
        });
      });
    });
  });

  describe('#typeAndVersion', function () {
    it('returns the correct version number', async function () {
      const versionNum = await staking.typeAndVersion();
      expect(versionNum).to.equal('Staking 0.1.0');
    });
  });

  describe('#getTotalCommunityStakedAmount', function () {
    beforeEach(async function () {
      await staking.connect(signers.owner).addOperators(signers.defaultOperators);
      await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
      await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);
      await staking.connect(signers.owner).setMerkleRoot(EMPTY_MERKLE_ROOT);
    });

    it('returns the total amount staked by the community stakers', async function () {
      let totalCommunityStakedAmount = await staking.getTotalCommunityStakedAmount();
      expect(totalCommunityStakedAmount).to.equal('0');

      await link.connect(signers.other).transferAndCall(staking.address, GENERAL_STAKE_AMOUNT, proof);

      totalCommunityStakedAmount = await staking.getTotalCommunityStakedAmount();
      expect(totalCommunityStakedAmount).to.equal(GENERAL_STAKE_AMOUNT);
    });
  });

  describe('#start', function () {
    beforeEach(async function () {
      await staking.connect(signers.owner).addOperators(signers.defaultOperators);
      await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
      await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);
    });

    it('#getDelegationRateDenominator returns the delegation rate', async function () {
      expect(await staking.getDelegationRateDenominator()).to.equal(DELEGATION_RATE_DENOMINATOR.toString());
    });
  });

  describe('#getEarnedDelegationRewards', function () {
    beforeEach(async function () {
      await staking.connect(signers.owner).addOperators(signers.defaultOperators);
      await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
      await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP]);
      await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);
    });

    describe('when community stakers have not staked', function () {
      it('returns 0', async function () {
        const earnedDelegationRewards = await staking.getEarnedDelegationRewards();
        expect(earnedDelegationRewards).to.equal('0');
      });

      describe('when operators have staked', function () {
        beforeEach(async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 1]);
          await link.connect(signers.operator).transferAndCall(staking.address, GENERAL_STAKE_AMOUNT, []);
        });

        it('returns 0', async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 2]);
          await hre.network.provider.send('evm_mine');

          const earnedDelegationRewards = await staking.getEarnedDelegationRewards();
          expect(earnedDelegationRewards).to.equal('0');
        });
      });
    });

    describe('when there are stakers', function () {
      beforeEach(async function () {
        await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 1]);
        await link.connect(signers.operator).transferAndCall(staking.address, GENERAL_STAKE_AMOUNT, []);

        await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 2]);
        await link.connect(signers.communityStaker).transferAndCall(staking.address, GENERAL_STAKE_AMOUNT, proof);
      });

      it('returns the total earned delegated rewards', async function () {
        await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 3]);
        await hre.network.provider.send('evm_mine');
        const earnedDelegatedRewards = await staking.getEarnedDelegationRewards();
        const expectedEarnedDelegatedRewards = getDelegationReward({
          inputs: [
            {
              amount: GENERAL_STAKE_AMOUNT,
              seconds: 1,
            },
          ],
        });
        expect(earnedDelegatedRewards).to.equal(expectedEarnedDelegatedRewards);
      });

      describe('when new operators join', async function () {
        beforeEach(async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 3]);
          await link.connect(signers.operatorTwo).transferAndCall(staking.address, INITIAL_MAX_COMMUNITY_STAKE, []);
        });

        it('returns the total earned delegated rewards', async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 4]);
          await hre.network.provider.send('evm_mine');
          const earnedDelegatedRewards = await staking.getEarnedDelegationRewards();
          const expectedEarnedDelegatedRewards = getDelegationReward({
            inputs: [
              {
                amount: GENERAL_STAKE_AMOUNT,
                seconds: 2,
              },
            ],
          });
          expect(earnedDelegatedRewards).to.equal(expectedEarnedDelegatedRewards);
        });

        describe('when an operator is removed 2 seconds after they stake', function () {
          beforeEach(async function () {
            await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 5]);
            await staking.connect(signers.owner).removeOperators([signers.operatorTwo.address]);
          });

          it('returns reduced delegated rewards', async function () {
            const earnedDelegatedRewards = await staking.getEarnedDelegationRewards();
            const expectedEarnedDelegatedRewards = getDelegationReward({
              inputs: [
                {
                  amount: GENERAL_STAKE_AMOUNT,
                  seconds: 2, // 1 second for single operator and 2 seconds divided between 2 operators
                },
              ],
            });
            expect(earnedDelegatedRewards).to.equal(expectedEarnedDelegatedRewards);
          });
        });
      });

      describe('when new stakers join', async function () {
        beforeEach(async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 3]);
          const aliceProof = getEncodedMerkleProof(merkleTree, signers.alice.address);
          await link.connect(signers.alice).transferAndCall(staking.address, INITIAL_MAX_COMMUNITY_STAKE, aliceProof);

          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 4]);
          const bobProof = getEncodedMerkleProof(merkleTree, signers.bob.address);
          await link.connect(signers.bob).transferAndCall(staking.address, INITIAL_MIN_COMMUNITY_STAKE, bobProof);
        });

        it('returns the total earned delegated rewards', async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 5]);
          await hre.network.provider.send('evm_mine');
          const earnedDelegatedRewards = await staking.getEarnedDelegationRewards();
          const expectedEarnedDelegatedRewards = getDelegationReward({
            inputs: [
              {
                amount: GENERAL_STAKE_AMOUNT,
                seconds: 3,
              },
              {
                amount: INITIAL_MAX_COMMUNITY_STAKE,
                seconds: 2,
              },
              {
                amount: INITIAL_MIN_COMMUNITY_STAKE,
                seconds: 1,
              },
            ],
          });
          expect(earnedDelegatedRewards).to.equal(expectedEarnedDelegatedRewards);
        });
      });
    });
  });

  shouldBehaveLikeConfirmedOwner('Staking', () => staking);
});
