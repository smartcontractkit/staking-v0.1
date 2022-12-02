import hre, { ethers } from 'hardhat';
import { expect } from 'chai';
import { MockContract } from 'ethereum-waffle';
import { LinkToken, RewardLib, Staking } from '../typechain';
import { Signers } from '../types';
import {
  PRIORITY_PERIOD_THRESHOLD_SECONDS,
  INITIAL_MIN_OPERATOR_STAKE,
  INITIAL_MIN_COMMUNITY_STAKE,
  INITIAL_START_TIMESTAMP,
  REWARD_PRECISION,
  MAX_ALERTING_REWARD_AMOUNT,
  PRIORITY_ROUND_THRESHOLD_SECONDS,
  REWARD_AMOUNT,
  setupContracts,
  SEVEN_DAYS,
  TEST_ROUND_ID,
  REWARD_RATE,
  SLASHABLE_DURATION,
} from './utils/setup';
import { getAlerterReward, getDelegationReward, getBaseReward } from './utils/rewards';
import { getEncodedMerkleProof } from './utils/merkleTree';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';

describe('Staking - AlertsController', function () {
  let signers: Signers;
  let staking: Staking;
  let link: LinkToken;
  let feed: MockContract;
  let rewardLib: RewardLib;

  beforeEach(async function () {
    const config = await setupContracts();
    signers = config.signers;
    staking = config.staking;
    link = config.link;
    feed = config.feed;
    rewardLib = config.rewardLib;

    await staking.connect(signers.owner).addOperators(signers.defaultOperators);
    await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
    await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP]);

    await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);

    await link.connect(signers.operator).transferAndCall(staking.address, INITIAL_MIN_OPERATOR_STAKE, []);

    const proof = getEncodedMerkleProof(config.merkleTree, signers.communityStaker.address);
    await link.connect(signers.communityStaker).transferAndCall(staking.address, INITIAL_MIN_COMMUNITY_STAKE, proof);

    await staking.connect(signers.owner).setFeedOperators([signers.operator.address, signers.operatorTwo.address]);
  });

  describe('#raiseAlert', function () {
    beforeEach(async function () {
      const { timestamp: latestBlockTimestamp } = await ethers.provider.getBlock('latest');
      const staleRoundTimestamp = latestBlockTimestamp - PRIORITY_PERIOD_THRESHOLD_SECONDS;
      await feed.mock.latestRoundData.returns(TEST_ROUND_ID, 0, 0, staleRoundTimestamp, 0);
    });

    describe('when pool is closed', function () {
      beforeEach(async function () {
        await staking.connect(signers.owner).conclude();
      });

      describe('when operator raises an alert', function () {
        it('reverts', async function () {
          await expect(staking.connect(signers.operator).raiseAlert()).to.be.revertedWith(
            'InvalidPoolStatus(false, true)',
          );
        });
      });

      describe('when community staker raises an alert', function () {
        it('reverts', async function () {
          await expect(staking.connect(signers.communityStaker).raiseAlert()).to.be.revertedWith(
            'InvalidPoolStatus(false, true)',
          );
        });
      });
    });

    describe('when feed is down for < downtime threshold', function () {
      beforeEach(async function () {
        const { timestamp: latestBlockTimestamp } = await ethers.provider.getBlock('latest');
        const notStaleTimestamp = latestBlockTimestamp - 1;
        await feed.mock.latestRoundData.returns(TEST_ROUND_ID, 0, 0, notStaleTimestamp, 0);
      });

      it('reverts', async function () {
        await expect(staking.connect(signers.communityStaker).raiseAlert()).to.be.revertedWith('AlertInvalid()');
      });
    });

    describe('when feed is down for >= downtime threshold', function () {
      beforeEach(async function () {
        const { timestamp: latestBlockTimestamp } = await ethers.provider.getBlock('latest');
        const staleRoundTimestamp = latestBlockTimestamp - PRIORITY_PERIOD_THRESHOLD_SECONDS;
        await feed.mock.latestRoundData.returns(TEST_ROUND_ID, 0, 0, staleRoundTimestamp, 0);
      });

      describe('during priority period (first 20 mins after downtime threshold)', function () {
        beforeEach(async function () {
          const { timestamp: latestBlockTimestamp } = await ethers.provider.getBlock('latest');
          await hre.network.provider.send('evm_setNextBlockTimestamp', [
            latestBlockTimestamp + PRIORITY_ROUND_THRESHOLD_SECONDS - 2,
          ]);
        });

        describe('when trying to raise an alert for the same round', function () {
          beforeEach(async function () {
            await staking.connect(signers.operator).raiseAlert();
          });

          it('reverts', async function () {
            await expect(staking.connect(signers.operator).raiseAlert()).to.be.revertedWith(
              `AlertAlreadyExists(${TEST_ROUND_ID})`,
            );
          });
        });

        describe('when raised by an operator', function () {
          describe('when operator has no stake', function () {
            it('reverts', async function () {
              await expect(staking.connect(signers.operatorTwo).raiseAlert()).to.be.revertedWith('AccessForbidden()');
            });
          });

          describe('when operator has stake', function () {
            it('emits an event', async function () {
              const rewardAmount = getAlerterReward({
                stakeAmount: INITIAL_MIN_OPERATOR_STAKE,
              });
              await expect(await staking.connect(signers.operator).raiseAlert())
                .to.emit(staking, 'AlertRaised')
                .withArgs(signers.operator.address, TEST_ROUND_ID, rewardAmount);
            });

            it('transfers alerter LINK rewards from the staking pool', async function () {
              const stakingPoolLINKBalanceBefore = await link.balanceOf(staking.address);
              await staking.connect(signers.operator).raiseAlert();
              const stakingPoolLINKBalanceAfter = await link.balanceOf(staking.address);
              expect(stakingPoolLINKBalanceBefore.sub(stakingPoolLINKBalanceAfter)).to.equal(
                MAX_ALERTING_REWARD_AMOUNT,
              );
            });

            it('transfers alerter LINK rewards to the alerter', async function () {
              const alerterLINKBalanceBefore = await link.balanceOf(signers.operator.address);
              await staking.connect(signers.operator).raiseAlert();
              const alerterLINKBalanceAfter = await link.balanceOf(signers.operator.address);
              expect(alerterLINKBalanceAfter.sub(alerterLINKBalanceBefore)).to.equal(MAX_ALERTING_REWARD_AMOUNT);
            });

            it('reduces the available rewards', async function () {
              const stakingPoolAvailableRewardsBefore = await staking.getAvailableReward();
              await staking.connect(signers.operator).raiseAlert();
              const stakingPoolAvailableRewardsAfter = await staking.getAvailableReward();
              expect(stakingPoolAvailableRewardsBefore.sub(stakingPoolAvailableRewardsAfter)).to.equal(
                MAX_ALERTING_REWARD_AMOUNT,
              );
            });

            it('reduces the reward duration', async function () {
              const [_, rewardEndTimestampBefore] = await staking.getRewardTimestamps();
              await hre.ethers.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 100]);
              await staking.connect(signers.operator).raiseAlert();
              const [, rewardEndTimestampAfter] = await staking.getRewardTimestamps();
              expect(rewardEndTimestampAfter.lt(rewardEndTimestampBefore)).to.equal(true);

              const rewardRate = await staking.getRewardRate();
              const maxPoolSize = await staking.getMaxPoolSize();
              const availableRewards = await staking.getAvailableReward();
              const rewardDuration = availableRewards.div(rewardRate).div(maxPoolSize.div(REWARD_PRECISION));

              expect(rewardEndTimestampAfter.sub(INITIAL_START_TIMESTAMP + 100)).to.equal(rewardDuration);
            });
          });
        });

        describe('when raised by a community staker', function () {
          it('reverts', async function () {
            await expect(staking.connect(signers.communityStaker).raiseAlert()).to.be.revertedWith('AlertInvalid()');
          });
        });
      });

      describe('during regular period (more than 20 mins after downtime threshold)', function () {
        beforeEach(async function () {
          const { timestamp: latestBlockTimestamp } = await ethers.provider.getBlock('latest');
          await hre.network.provider.send('evm_setNextBlockTimestamp', [
            latestBlockTimestamp + PRIORITY_ROUND_THRESHOLD_SECONDS + 100,
          ]);

          await hre.network.provider.send('evm_mine');
        });

        describe('when raised by an operator', function () {
          describe('when operator has stake', function () {
            it('emits an event', async function () {
              const rewardAmount = getAlerterReward({
                isRegularPeriod: true,
                stakeAmount: INITIAL_MIN_OPERATOR_STAKE,
              });
              await expect(await staking.connect(signers.operator).raiseAlert())
                .to.emit(staking, 'AlertRaised')
                .withArgs(signers.operator.address, TEST_ROUND_ID, rewardAmount);
            });
          });
        });

        describe('when raised by a community staker', function () {
          describe('when community staker has stake', function () {
            it('emits an event', async function () {
              const rewardAmount = getAlerterReward({
                isRegularPeriod: true,
                stakeAmount: INITIAL_MIN_COMMUNITY_STAKE,
              });
              await expect(await staking.connect(signers.communityStaker).raiseAlert())
                .to.emit(staking, 'AlertRaised')
                .withArgs(signers.communityStaker.address, TEST_ROUND_ID, rewardAmount);
            });
          });
        });

        describe('when supplied a non community staker', function () {
          it('reverts', async function () {
            await expect(staking.connect(signers.other).raiseAlert()).to.be.revertedWith('AccessForbidden()');
          });
        });
      });
    });

    describe('when on feed operator has accumulated less than 90 days worth of rewards', function () {
      beforeEach(async function () {
        const { timestamp: latestBlockTimestamp } = await ethers.provider.getBlock('latest');
        await hre.network.provider.send('evm_setNextBlockTimestamp', [latestBlockTimestamp + SEVEN_DAYS]);
        await hre.network.provider.send('evm_mine');
      });

      describe('during regular period (more than 20 mins after downtime threshold)', function () {
        beforeEach(async function () {
          const { timestamp: latestBlockTimestamp } = await ethers.provider.getBlock('latest');
          await hre.network.provider.send('evm_setNextBlockTimestamp', [
            latestBlockTimestamp + PRIORITY_ROUND_THRESHOLD_SECONDS + 100,
          ]);
        });

        it('does not slash more than the earned base reward amount', async function () {
          await staking.connect(signers.communityStaker).raiseAlert();
          const onFeedOperatorBaseReward = await staking.getBaseReward(signers.operator.address);
          expect(onFeedOperatorBaseReward).to.equal(0);
        });

        it('does not slash more than the earned delegation reward amount', async function () {
          await staking.connect(signers.communityStaker).raiseAlert();
          const onFeedOperatorDelegatedReward = await staking.getDelegationReward(signers.operator.address);
          expect(onFeedOperatorDelegatedReward).to.equal(0);
        });

        it('does not slash the base rewards for an on feed operator who has not staked', async function () {
          await staking.connect(signers.communityStaker).raiseAlert();
          const onFeedOperatorBaseReward = await staking.getBaseReward(signers.operatorTwo.address);
          expect(onFeedOperatorBaseReward).to.equal(0);
        });

        it('does not slash the delegated rewards an on feed operator who has not staked', async function () {
          await staking.connect(signers.communityStaker).raiseAlert();
          const onFeedOperatorDelegatedReward = await staking.getDelegationReward(signers.operatorTwo.address);
          expect(onFeedOperatorDelegatedReward).to.equal(0);
        });

        it('does not emit an event for an operator who has not staked', async function () {
          await expect(staking.connect(signers.communityStaker).raiseAlert())
            .to.not.emit(rewardLib.connect(staking.address), 'RewardSlashed')
            .withArgs([signers.operatorTwo.address], [anyValue], [anyValue]);
        });
      });
    });

    describe('when on feed operator has accumulated at least 90 days worth of rewards', function () {
      beforeEach(async function () {
        const { timestamp: latestBlockTimestamp } = await ethers.provider.getBlock('latest');
        await hre.network.provider.send('evm_setNextBlockTimestamp', [latestBlockTimestamp + SLASHABLE_DURATION]);
        await hre.network.provider.send('evm_mine');
      });

      describe('during regular period (more than 20 mins after downtime threshold)', function () {
        beforeEach(async function () {
          const { timestamp: latestBlockTimestamp } = await ethers.provider.getBlock('latest');
          await hre.network.provider.send('evm_setNextBlockTimestamp', [
            latestBlockTimestamp + PRIORITY_ROUND_THRESHOLD_SECONDS + 100,
          ]);
          await hre.network.provider.send('evm_mine');
        });

        it('slashes 90 days worth of base rewards for an on feed operator', async function () {
          const { timestamp: latestBlockTimestamp } = await ethers.provider.getBlock('latest');
          const onFeedOperatorBaseRewardBefore = getBaseReward({
            stakeAmount: INITIAL_MIN_OPERATOR_STAKE,
            secondsStaked: latestBlockTimestamp - INITIAL_START_TIMESTAMP,
            isTokenholder: false,
          });
          await staking.connect(signers.communityStaker).raiseAlert();
          const slashableRewards = getBaseReward({
            stakeAmount: INITIAL_MIN_OPERATOR_STAKE,
            secondsStaked: SLASHABLE_DURATION,
            isTokenholder: false,
          });
          const onFeedOperatorBaseRewardAfter = await staking.getBaseReward(signers.operator.address);
          expect(onFeedOperatorBaseRewardAfter).to.equal(onFeedOperatorBaseRewardBefore.sub(slashableRewards));
        });

        it('slashes 90 days worth of delegation rewards for an on feed operator', async function () {
          const { timestamp: latestBlockTimestamp } = await ethers.provider.getBlock('latest');

          // TH staked one second after the initial start timestamp.
          const lastAccumulateTime = INITIAL_START_TIMESTAMP + 1;
          const onFeedDelegatedRewardBefore = getDelegationReward({
            inputs: [
              {
                amount: INITIAL_MIN_COMMUNITY_STAKE,
                seconds: latestBlockTimestamp - lastAccumulateTime,
              },
            ],
          });
          await staking.connect(signers.communityStaker).raiseAlert();
          const slashableRewards = getDelegationReward({
            inputs: [
              {
                amount: INITIAL_MIN_COMMUNITY_STAKE,
                seconds: SLASHABLE_DURATION,
              },
            ],
          });
          const onFeedDelegatedRewardAfter = await staking.getDelegationReward(signers.operator.address);
          expect(onFeedDelegatedRewardAfter).to.equal(onFeedDelegatedRewardBefore.sub(slashableRewards));
        });

        it('emits an event', async function () {
          const slashedBaseRewards = getBaseReward({
            stakeAmount: INITIAL_MIN_OPERATOR_STAKE,
            isTokenholder: false,
            secondsStaked: SLASHABLE_DURATION,
          });
          const slashedDelegatedRewards = getDelegationReward({
            inputs: [
              {
                seconds: SLASHABLE_DURATION,
                amount: INITIAL_MIN_COMMUNITY_STAKE,
              },
            ],
          });
          await expect(staking.connect(signers.communityStaker).raiseAlert())
            .to.emit(rewardLib.attach(staking.address), 'RewardSlashed')
            .withArgs([signers.operator.address], [slashedBaseRewards], [slashedDelegatedRewards]);
        });

        it("does not slash a non feed operator's base reward", async function () {
          const onFeedOperatorBaseRewardBefore = await staking.getBaseReward(signers.operatorTwo.address);
          await staking.connect(signers.communityStaker).raiseAlert();
          const onFeedOperatorBaseRewardAfter = await staking.getBaseReward(signers.operatorTwo.address);
          expect(onFeedOperatorBaseRewardAfter).to.equal(onFeedOperatorBaseRewardBefore);
        });

        it("does not slash a non feed operator's delegation reward", async function () {
          const onFeedOperatorBaseRewardBefore = await staking.getDelegationReward(signers.operatorTwo.address);
          await staking.connect(signers.communityStaker).raiseAlert();
          const onFeedOperatorBaseRewardAfter = await staking.getDelegationReward(signers.operatorTwo.address);
          expect(onFeedOperatorBaseRewardAfter).to.equal(onFeedOperatorBaseRewardBefore);
        });

        it('does not slash the base rewards for an on feed operator who has not staked', async function () {
          await staking.connect(signers.communityStaker).raiseAlert();
          const onFeedOperatorBaseReward = await staking.getBaseReward(signers.operatorTwo.address);
          expect(onFeedOperatorBaseReward).to.equal(0);
        });

        it('does not slash the delegated rewards an on feed operator who has not staked', async function () {
          await staking.connect(signers.communityStaker).raiseAlert();
          const onFeedOperatorDelegatedReward = await staking.getDelegationReward(signers.operatorTwo.address);
          expect(onFeedOperatorDelegatedReward).to.equal(0);
        });

        it('does not emit an event for an operator who has not staked', async function () {
          await expect(staking.connect(signers.communityStaker).raiseAlert())
            .to.not.emit(rewardLib.connect(staking.address), 'RewardSlashed')
            .withArgs([signers.operatorTwo.address], [anyValue], [anyValue]);
        });
      });
    });

    describe('when no operator has staked', function () {
      beforeEach(async function () {
        await staking.connect(signers.owner).setFeedOperators([]);
        await staking.connect(signers.owner).removeOperators([signers.operator.address]);
      });

      describe('during regular period (more than 20 mins after downtime threshold)', function () {
        beforeEach(async function () {
          const { timestamp: latestBlockTimestamp } = await ethers.provider.getBlock('latest');
          await hre.network.provider.send('evm_setNextBlockTimestamp', [
            latestBlockTimestamp + PRIORITY_ROUND_THRESHOLD_SECONDS + 100,
          ]);

          await hre.network.provider.send('evm_mine');
        });

        describe('when raised by a community staker', function () {
          describe('when community staker has stake', function () {
            it('raises an alert, but does not slash', async function () {
              const rewardAmount = getAlerterReward({
                isRegularPeriod: true,
                stakeAmount: INITIAL_MIN_COMMUNITY_STAKE,
              });
              const tx = await staking.connect(signers.communityStaker).raiseAlert();
              await expect(tx)
                .to.emit(staking, 'AlertRaised')
                .withArgs(signers.communityStaker.address, TEST_ROUND_ID, rewardAmount);
              await expect(tx).to.not.emit(rewardLib.attach(staking.address), 'RewardSlashed');
            });
          });
        });
      });
    });
  });

  describe('#canAlert', function () {
    describe('when feed is down for < downtime threshold', function () {
      beforeEach(async function () {
        const { timestamp: latestBlockTimestamp } = await ethers.provider.getBlock('latest');
        const notStaleTimestamp = latestBlockTimestamp - 1;
        await feed.mock.latestRoundData.returns(TEST_ROUND_ID, 0, 0, notStaleTimestamp, 0);
      });

      it('returns false', async function () {
        expect(await staking.canAlert(signers.operator.address)).to.equal(false);
      });
    });

    describe('when feed is down for >= downtime threshold', function () {
      beforeEach(async function () {
        const { timestamp: latestBlockTimestamp } = await ethers.provider.getBlock('latest');
        const staleRoundTimestamp = latestBlockTimestamp - PRIORITY_PERIOD_THRESHOLD_SECONDS;
        await feed.mock.latestRoundData.returns(TEST_ROUND_ID, 0, 0, staleRoundTimestamp, 0);
      });

      describe('during priority period (first 20 mins after downtime threshold)', function () {
        beforeEach(async function () {
          const { timestamp: latestBlockTimestamp } = await ethers.provider.getBlock('latest');
          await hre.network.provider.send('evm_setNextBlockTimestamp', [
            latestBlockTimestamp + PRIORITY_ROUND_THRESHOLD_SECONDS - 2,
          ]);
          await hre.network.provider.send('evm_mine');
        });

        describe('when supplied an operator', function () {
          describe('when operator has no stake', function () {
            it('returns false', async function () {
              expect(await staking.canAlert(signers.operatorTwo.address)).to.equal(false);
            });
          });

          describe('when operator has stake', function () {
            it('returns true', async function () {
              expect(await staking.canAlert(signers.operator.address)).to.equal(true);
            });

            describe('when an alert has already been raised for that round ID', function () {
              beforeEach(async function () {
                await staking.connect(signers.operator).raiseAlert();
              });

              it('returns false', async function () {
                expect(await staking.canAlert(signers.operator.address)).to.equal(false);
              });
            });
          });
        });

        describe('when supplied a community staker', function () {
          it('returns false', async function () {
            expect(await staking.canAlert(signers.communityStaker.address)).to.equal(false);
          });
        });
      });

      describe('during regular period (more than 20 mins after downtime threshold)', function () {
        beforeEach(async function () {
          const { timestamp: latestBlockTimestamp } = await ethers.provider.getBlock('latest');
          await hre.network.provider.send('evm_setNextBlockTimestamp', [
            latestBlockTimestamp + PRIORITY_ROUND_THRESHOLD_SECONDS + 1,
          ]);
          await hre.network.provider.send('evm_mine');
        });

        describe('when supplied an operator', function () {
          describe('when operator has no stake', function () {
            beforeEach(async function () {
              expect(await staking.getStake(signers.operatorTwo.address)).to.equal(0);
            });

            it('returns false', async function () {
              expect(await staking.canAlert(signers.operatorTwo.address)).to.equal(false);
            });
          });

          describe('when operator has stake', function () {
            it('returns true', async function () {
              expect(await staking.canAlert(signers.operator.address)).to.equal(true);
            });
          });

          describe('when pool is not active', function () {
            beforeEach(async function () {
              await staking.connect(signers.owner).conclude();
              expect(await staking.isActive()).to.equal(false);
            });

            it('returns false', async function () {
              expect(await staking.canAlert(signers.operator.address)).to.equal(false);
            });
          });
        });

        describe('when supplied a community staker', function () {
          describe('when community staker has stake', function () {
            it('returns true', async function () {
              expect(await staking.canAlert(signers.communityStaker.address)).to.equal(true);
            });
          });
        });

        describe('when supplied a non community staker', function () {
          it('returns false', async function () {
            expect(await staking.canAlert(signers.other.address)).to.equal(false);
          });
        });
      });
    });
  });
});
