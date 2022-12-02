import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import { Signers } from '../types';
import { Staking } from '../typechain';
import {
  GENERAL_STAKE_AMOUNT,
  INITIAL_MAX_OPERATOR_STAKE,
  INITIAL_MIN_OPERATOR_STAKE,
  INITIAL_MIN_COMMUNITY_STAKE,
  INITIAL_START_TIMESTAMP,
  REWARD_AMOUNT,
  setupContracts,
  REWARD_RATE,
  LOW_REWARD_RATE,
  REWARD_PRECISION,
} from './utils/setup';
import { LinkToken } from '../typechain';
import { shouldRespectStakingPoolRules } from './Staking.shared.behaviour';
import { getDelegationReward, getBaseReward } from './utils/rewards';
import MerkleTree from 'merkletreejs';
import { getEncodedMerkleProof } from './utils/merkleTree';
import { EMPTY_MERKLE_ROOT } from './utils/mockdata';

describe('Staking - operator', function () {
  let signers: Signers;
  let staking: Staking;
  let link: LinkToken;
  let merkleTree: MerkleTree;
  let proof: string;

  beforeEach(async function () {
    const config = await setupContracts();
    signers = config.signers;
    staking = config.staking;
    merkleTree = config.merkleTree;
    proof = getEncodedMerkleProof(merkleTree, signers.communityStaker.address);
    link = config.link;

    await staking.addOperators(signers.defaultOperators);
  });

  shouldRespectStakingPoolRules(
    () => ({ staking, link }),
    () => signers.operator,
    () => merkleTree,
  );

  describe('#isOperator', function () {
    it('returns true', async function () {
      expect(await staking.isOperator(signers.operator.address)).to.equal(true);
    });
  });

  describe('#getBaseReward', function () {
    describe('when no principal is staked', function () {
      it('returns no rewards', async function () {
        const reward = await staking.getBaseReward(signers.operator.address);
        expect(reward).to.equal('0');
      });
    });

    describe('when staking the minimum stake amount', function () {
      beforeEach(async function () {
        await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
        await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP]);
        await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);

        await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 10]);
        await link.connect(signers.operator).transferAndCall(staking.address, INITIAL_MIN_OPERATOR_STAKE, []);
      });

      it('returns no rewards just after staking', async function () {
        const reward = await staking.getBaseReward(signers.operator.address);
        expect(reward).to.equal('0');
      });

      describe('when staking concludes', function () {
        beforeEach(async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 11]);
          await staking.connect(signers.owner).conclude();
        });

        describe('when 10 seconds pass', function () {
          beforeEach(async function () {
            await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 101]);
            await hre.network.provider.send('evm_mine');
          });

          it('returns a correct amount of rewards', async function () {
            const rewardAfter1Second = await staking.getBaseReward(signers.operator.address);
            const expectedReward = getBaseReward({
              stakeAmount: INITIAL_MIN_OPERATOR_STAKE,
              secondsStaked: 1,
              isTokenholder: false,
            });
            expect(rewardAfter1Second).to.equal(expectedReward);
          });
        });
      });

      describe('when 1 second has passed', async function () {
        beforeEach(async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 11]);
          await hre.network.provider.send('evm_mine');
        });

        it('returns 1 second worth of rewards', async function () {
          const rewardAfter1Second = await staking.getBaseReward(signers.operator.address);
          const expectedReward = getBaseReward({
            stakeAmount: INITIAL_MIN_OPERATOR_STAKE,
            secondsStaked: 1,
            isTokenholder: false,
          });
          expect(rewardAfter1Second).to.equal(expectedReward);
        });
      });

      describe('when reward rate is updated after 10 seconds', function () {
        const newRate = REWARD_RATE.div(2);

        beforeEach(async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 20]);
          await staking.connect(signers.owner).changeRewardRate(newRate);
        });

        describe('when 10 seconds have passed since the rate has been changed', function () {
          beforeEach(async function () {
            await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 30]);
            await hre.network.provider.send('evm_mine');
          });

          it('returns the correct reward amount', async function () {
            const FIRST_ROUND_REWARD = getBaseReward({
              stakeAmount: INITIAL_MIN_OPERATOR_STAKE,
              secondsStaked: 10,
              isTokenholder: false,
            });
            const SECOND_ROUND_REWARD = getBaseReward({
              stakeAmount: INITIAL_MIN_OPERATOR_STAKE,
              secondsStaked: 10,
              rewardRate: newRate,
              isTokenholder: false,
            });
            const reward = await staking.getBaseReward(signers.operator.address);
            expect(reward).to.equal(FIRST_ROUND_REWARD.add(SECOND_ROUND_REWARD));
          });

          describe('10 seconds after the reward rate is changed again', function () {
            const thirdRewardRate = LOW_REWARD_RATE;
            beforeEach(async function () {
              await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 31]);
              await staking.connect(signers.owner).changeRewardRate(thirdRewardRate);
              // Changing the reward rate mines a new block so the timestamp is incremented by 1
              await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 41]);
              await hre.network.provider.send('evm_mine');
            });

            it('returns the correct reward amount', async function () {
              const FIRST_ROUND_REWARD = getBaseReward({
                stakeAmount: INITIAL_MIN_OPERATOR_STAKE,
                secondsStaked: 10,
                isTokenholder: false,
              });
              const SECOND_ROUND_REWARD = getBaseReward({
                stakeAmount: INITIAL_MIN_OPERATOR_STAKE,
                secondsStaked: 11,
                rewardRate: newRate,
                isTokenholder: false,
              });
              const THIRD_ROUND_REWARD = getBaseReward({
                stakeAmount: INITIAL_MIN_OPERATOR_STAKE,
                secondsStaked: 10,
                rewardRate: thirdRewardRate,
                isTokenholder: false,
              });
              const reward = await staking.getBaseReward(signers.operator.address);
              expect(reward).to.equal(FIRST_ROUND_REWARD.add(SECOND_ROUND_REWARD).add(THIRD_ROUND_REWARD));
            });
          });
        });
      });

      describe('when staking the minimum stake amount again after 10 seconds', function () {
        beforeEach(async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 20]);
          await link.connect(signers.operator).transferAndCall(staking.address, INITIAL_MIN_OPERATOR_STAKE, []);
        });

        it('returns 10 seconds worth of rewards for initial stake', async function () {
          const reward = await staking.getBaseReward(signers.operator.address);
          const FIRST_STAKE_REWARD = getBaseReward({
            stakeAmount: INITIAL_MIN_OPERATOR_STAKE,
            secondsStaked: 10,
            isTokenholder: false,
          });
          expect(reward).to.equal(FIRST_STAKE_REWARD);
        });

        describe('when 20 seconds have passed after the initial stake', function () {
          beforeEach(async function () {
            await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 30]);
            await hre.network.provider.send('evm_mine');
          });

          it('returns correct rewards', async function () {
            const reward = await staking.getBaseReward(signers.operator.address);
            const FIRST_STAKE_REWARD = getBaseReward({
              stakeAmount: INITIAL_MIN_OPERATOR_STAKE,
              secondsStaked: 20,
              isTokenholder: false,
            });
            const SECOND_STAKE_REWARD = getBaseReward({
              stakeAmount: INITIAL_MIN_OPERATOR_STAKE,
              secondsStaked: 10,
              isTokenholder: false,
            });
            expect(reward).to.equal(FIRST_STAKE_REWARD.add(SECOND_STAKE_REWARD));
          });
        });
      });
    });
  });

  describe('#stake', function () {
    describe('when pool is open', function () {
      beforeEach(async function () {
        await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
        await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP]);
        await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);
      });

      describe('when called with an adequate stake amount', function () {
        it('staked amount is added to the principal balance', async function () {
          await link.connect(signers.operator).transferAndCall(staking.address, INITIAL_MIN_OPERATOR_STAKE, []);

          const stake = await staking.getStake(signers.operator.address);
          expect(stake).to.equal(INITIAL_MIN_OPERATOR_STAKE);
        });

        it('should emit an event', async function () {
          await expect(link.connect(signers.operator).transferAndCall(staking.address, INITIAL_MIN_OPERATOR_STAKE, []))
            .to.emit(staking, 'Staked')
            .withArgs(signers.operator.address, INITIAL_MIN_OPERATOR_STAKE, INITIAL_MIN_OPERATOR_STAKE);

          await expect(link.connect(signers.operator).transferAndCall(staking.address, INITIAL_MIN_OPERATOR_STAKE, []))
            .to.emit(staking, 'Staked')
            .withArgs(signers.operator.address, INITIAL_MIN_OPERATOR_STAKE, INITIAL_MIN_OPERATOR_STAKE.mul(2));
        });

        it('increases delegates count', async function () {
          const delegateCountBefore = await staking.getDelegatesCount();
          await link.connect(signers.operator).transferAndCall(staking.address, INITIAL_MIN_OPERATOR_STAKE, []);
          const delegateCountAfter = await staking.getDelegatesCount();
          expect(delegateCountAfter.sub(delegateCountBefore)).to.equal(1);
        });

        describe('when operator has staked', function () {
          beforeEach(async function () {
            await link.connect(signers.operator).transferAndCall(staking.address, INITIAL_MIN_OPERATOR_STAKE, []);
          });

          it('staking does not increase delegates count', async function () {
            await link.connect(signers.operator).transferAndCall(staking.address, INITIAL_MIN_OPERATOR_STAKE, []);
            const delegateCount = await staking.getDelegatesCount();
            expect(delegateCount).to.equal(1);
          });
        });

        it('the staked amount in LINK tokens is added to the staking contract', async function () {
          const linkBalanceBefore = await link.balanceOf(staking.address);
          await link.connect(signers.operator).transferAndCall(staking.address, INITIAL_MIN_OPERATOR_STAKE, []);

          const linkBalanceAfter = await link.balanceOf(staking.address);
          expect(linkBalanceAfter.sub(linkBalanceBefore)).to.equal(INITIAL_MIN_OPERATOR_STAKE);
        });

        it('additional staked amounts are added to the principal balance', async function () {
          await link.connect(signers.operator).transferAndCall(staking.address, INITIAL_MIN_OPERATOR_STAKE, []);
          await link.connect(signers.operator).transferAndCall(staking.address, INITIAL_MIN_OPERATOR_STAKE, []);
          const stake = await staking.getStake(signers.operator.address);
          expect(stake).to.equal(INITIAL_MIN_OPERATOR_STAKE.mul(2));
        });

        it('reverts when called from a non-LINK address', async function () {
          await expect(
            staking.connect(signers.operator).onTokenTransfer(signers.operator.address, INITIAL_MIN_OPERATOR_STAKE, []),
          ).to.be.revertedWith('SenderNotLinkToken()');
        });
      });

      describe('when called with insufficient stake amount', function () {
        it('reverts', async function () {
          const insufficientStakeAmount = INITIAL_MIN_OPERATOR_STAKE.sub(REWARD_PRECISION);
          await expect(
            link.connect(signers.operator).transferAndCall(staking.address, insufficientStakeAmount, []),
          ).to.be.revertedWith(`InsufficientStakeAmount(${INITIAL_MIN_OPERATOR_STAKE})`);
        });

        it('reverts', async function () {
          const insufficientStakeAmount = REWARD_PRECISION.sub(1);
          await expect(
            link.connect(signers.operator).transferAndCall(staking.address, insufficientStakeAmount, []),
          ).to.be.revertedWith(`InsufficientStakeAmount(${REWARD_PRECISION})`);
        });
      });

      describe('when called with excessive stake amount', function () {
        it('reverts', async function () {
          const excessiveStakeAmount = INITIAL_MAX_OPERATOR_STAKE.add(REWARD_PRECISION);
          await expect(
            link.connect(signers.operator).transferAndCall(staking.address, excessiveStakeAmount, []),
          ).to.be.revertedWith(`ExcessiveStakeAmount(${INITIAL_MAX_OPERATOR_STAKE})`);
        });
      });

      describe('when staking an amount at risk of rounding loss', function () {
        const stakeAmount = ethers.utils.parseUnits('3000.999999', 18);
        beforeEach(async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 1]);
          await link.connect(signers.operator).transferAndCall(staking.address, stakeAmount, []);
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 2]);
          await hre.network.provider.send('evm_mine');
        });

        it('returns 1 second worth of reward with 6 decimal precision', async function () {
          const rewardAfter1Second = await staking.getBaseReward(signers.operator.address);
          const expectedReward = getBaseReward({
            stakeAmount: stakeAmount,
            secondsStaked: 1,
            isTokenholder: false,
          });
          expect(rewardAfter1Second).to.equal(expectedReward);
        });
      });
    });
    describe('when the pool is closed', function () {
      beforeEach(async function () {
        await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
        await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP]);
        await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);
        await staking.connect(signers.owner).conclude();
      });

      it('reverts', async () => {
        await expect(
          link.connect(signers.operator).transferAndCall(staking.address, INITIAL_MIN_OPERATOR_STAKE, []),
        ).to.revertedWith(`InvalidPoolStatus(false, true)`);
      });
    });
  });

  describe('#unstake', function () {
    beforeEach(async function () {
      await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
      await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP]);
      await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);
    });

    describe('when stake exists, T1', function () {
      beforeEach(async function () {
        await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 1]);
        await link.connect(signers.operator).transferAndCall(staking.address, GENERAL_STAKE_AMOUNT, []);
      });

      describe('when reward rate is changed, T2', function () {
        const newRate = REWARD_RATE.div(2);

        beforeEach(async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 2]);
          await staking.connect(signers.owner).changeRewardRate(newRate);
        });

        describe('when pool is closed, T3', function () {
          beforeEach(async function () {
            await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 3]);
            await staking.connect(signers.owner).conclude();
          });

          it('transfers the principal and rewards from the staking contract', async function () {
            const stakingContractLINKBalanceBefore = await link.balanceOf(staking.address);
            const stake = await staking.getStake(signers.operator.address);
            await link.connect(signers.owner).transfer(staking.address, ethers.utils.parseUnits('1', '18'));
            const baseReward = await staking.getBaseReward(signers.operator.address);
            const delegationReward = await staking.getDelegationReward(signers.operator.address);
            await staking.connect(signers.operator).unstake();

            const stakingContractLINKBalanceAfter = await link.balanceOf(staking.address);
            expect(
              stakingContractLINKBalanceBefore
                .sub(stakingContractLINKBalanceAfter)
                .add(ethers.utils.parseUnits('1', '18')),
            ).to.equal(stake.add(baseReward).add(delegationReward));
          });

          it('transfers the principal and rewards to the staker', async function () {
            const stakerLINKBalanceBefore = await link.balanceOf(signers.operator.address);
            const stake = await staking.getStake(signers.operator.address);
            await link.connect(signers.owner).transfer(staking.address, ethers.utils.parseUnits('1', '18'));
            const baseReward = await staking.getBaseReward(signers.operator.address);
            const delegationReward = await staking.getDelegationReward(signers.operator.address);
            await staking.connect(signers.operator).unstake();

            const stakerLINKBalanceAfter = await link.balanceOf(signers.operator.address);
            expect(stakerLINKBalanceAfter.sub(stakerLINKBalanceBefore)).to.equal(
              stake.add(baseReward).add(delegationReward),
            );
          });
        });
      });

      describe('when community staker staked, T2', function () {
        beforeEach(async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 2]);
          await link
            .connect(signers.communityStaker)
            .transferAndCall(staking.address, INITIAL_MIN_COMMUNITY_STAKE, proof);
        });

        describe('when pool is closed, T3', function () {
          beforeEach(async function () {
            await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 3]);
            await staking.connect(signers.owner).conclude();
          });

          it('transfers the principal and rewards from the staking contract', async function () {
            const stakingContractLINKBalanceBefore = await link.balanceOf(staking.address);
            const stake = await staking.getStake(signers.operator.address);
            const baseReward = await staking.getBaseReward(signers.operator.address);
            const delegationReward = await staking.getDelegationReward(signers.operator.address);

            await staking.connect(signers.operator).unstake();

            const stakingContractLINKBalanceAfter = await link.balanceOf(staking.address);
            expect(stakingContractLINKBalanceBefore.sub(stakingContractLINKBalanceAfter)).to.equal(
              stake.add(baseReward).add(delegationReward),
            );
          });

          it('transfers the principal and rewards to the staker', async function () {
            const stakerLINKBalanceBefore = await link.balanceOf(signers.operator.address);
            const stake = await staking.getStake(signers.operator.address);
            const baseReward = await staking.getBaseReward(signers.operator.address);
            const delegationReward = await staking.getDelegationReward(signers.operator.address);
            await staking.connect(signers.operator).unstake();

            const stakerLINKBalanceAfter = await link.balanceOf(signers.operator.address);
            expect(stakerLINKBalanceAfter.sub(stakerLINKBalanceBefore)).to.equal(
              stake.add(baseReward).add(delegationReward),
            );
          });

          it('should emit an event', async function () {
            const baseReward = await staking.getBaseReward(signers.operator.address);
            const delegationReward = await staking.getDelegationReward(signers.operator.address);

            await expect(staking.connect(signers.operator).unstake())
              .to.emit(staking, 'Unstaked')
              .withArgs(signers.operator.address, GENERAL_STAKE_AMOUNT, baseReward, delegationReward);
          });
        });
      });
    });
  });

  describe('#getDelegationReward', function () {
    describe('when Operator has staked, T1', function () {
      beforeEach(async function () {
        await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
        await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP]);
        await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);
        expect(await staking.isActive()).to.equal(true);
        await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 1]);
        await link.connect(signers.operator).transferAndCall(staking.address, INITIAL_MIN_OPERATOR_STAKE, []);
      });

      describe('when community staker has staked, T2', function () {
        beforeEach(async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 2]);
          await link
            .connect(signers.communityStaker)
            .transferAndCall(staking.address, INITIAL_MIN_COMMUNITY_STAKE, proof);
        });

        describe('when reward rate is changed after 1 seconds', function () {
          const newRate = REWARD_RATE.div(2);

          beforeEach(async function () {
            await hre.ethers.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 3]);
            await staking.connect(signers.owner).changeRewardRate(newRate);
          });

          it('should still return the correct amount of earned delegated rewards', async function () {
            const expectedEarnedDelegatedRewards = getDelegationReward({
              inputs: [
                {
                  amount: INITIAL_MIN_COMMUNITY_STAKE,
                  seconds: 1,
                },
              ],
            });
            const earnedDelegatedRewards = await staking.getDelegationReward(signers.operator.address);
            expect(earnedDelegatedRewards).to.equal(expectedEarnedDelegatedRewards);
          });

          describe('after 1 seconds has passed', function () {
            beforeEach(async function () {
              await hre.ethers.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 4]);
              await hre.ethers.provider.send('evm_mine', []);
            });

            it('should still return the correct amount of earned delegated rewards', async function () {
              const expectedEarnedDelegatedRewardsOldRate = getDelegationReward({
                inputs: [
                  {
                    amount: INITIAL_MIN_COMMUNITY_STAKE,
                    seconds: 1,
                  },
                ],
              });
              const expectedEarnedDelegatedRewardsNewRate = getDelegationReward({
                inputs: [
                  {
                    amount: INITIAL_MIN_COMMUNITY_STAKE,
                    seconds: 1,
                    rewardRate: newRate,
                  },
                ],
              });
              const earnedDelegatedRewards = await staking.getDelegationReward(signers.operator.address);
              expect(earnedDelegatedRewards).to.equal(
                expectedEarnedDelegatedRewardsOldRate.add(expectedEarnedDelegatedRewardsNewRate),
              );
            });
          });
        });

        it('returns the correct delegation reward', async function () {
          const delegationReward = await staking.getDelegationReward(signers.operator.address);
          expect(delegationReward).to.equal('0');
        });

        describe('when T3', function () {
          beforeEach(async function () {
            await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 3]);
            await hre.network.provider.send('evm_mine', []);
          });

          it('returns the correct delegation reward', async function () {
            const delegationReward = await staking.getDelegationReward(signers.operator.address);

            const expectedDelegationRewardAmount = getDelegationReward({
              inputs: [{ amount: INITIAL_MIN_COMMUNITY_STAKE, seconds: 1 }],
            });
            expect(delegationReward).to.equal(expectedDelegationRewardAmount);
          });
        });

        describe('when reward depletes', function () {
          beforeEach(async function () {
            const [_, rewardEndTimestamp] = await staking.getRewardTimestamps();
            await hre.network.provider.send('evm_setNextBlockTimestamp', [rewardEndTimestamp.toNumber()]);
            await hre.network.provider.send('evm_mine', []);
          });

          it('delegation reward does not change as community stakers unstake', async function () {
            const delegationRewardBeforeUnstake = await staking.getDelegationReward(signers.operator.address);

            await staking.connect(signers.communityStaker).unstake();

            const delegationRewardAfterUnstake = await staking.getDelegationReward(signers.operator.address);

            expect(delegationRewardBeforeUnstake.toString()).to.equal(delegationRewardAfterUnstake.toString());
          });
        });
      });
    });
  });

  describe('#withdrawRemovedStake', function () {
    beforeEach(async function () {
      await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
      await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP]);
      await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);
    });

    it('works after unstake', async function () {
      // Stake as an operator
      await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 10]);
      await link.connect(signers.operator).transferAndCall(staking.address, GENERAL_STAKE_AMOUNT, []);

      // Remove an operator who has a stake
      await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 20]);
      // We need to removed feed operators to be able to remove an operator
      await staking.connect(signers.owner).setFeedOperators([]);

      await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 30]);
      await staking.connect(signers.owner).removeOperators([signers.operator.address]);

      // We need to allow all stakers
      await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 31]);
      await staking.connect(signers.owner).setMerkleRoot(EMPTY_MERKLE_ROOT);

      // Removed operator stakes as a community staker
      await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 40]);
      await link.connect(signers.operator).transferAndCall(staking.address, GENERAL_STAKE_AMOUNT, []);

      // Conclude staking
      await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 50]);
      await staking.connect(signers.owner).conclude();

      const operatorBalanceBeforeFirstUnstake = await link.balanceOf(signers.operator.address);

      // Withdraw stake with rewards
      await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 60]);
      await staking.connect(signers.operator).unstake();

      const FIRST_STAKE_REWARD = getBaseReward({
        stakeAmount: GENERAL_STAKE_AMOUNT,
        secondsStaked: 10,
        isTokenholder: true,
      });

      const operatorBalanceAfterFirstUnstake = await link.balanceOf(signers.operator.address);
      const expectedOperatorBalanceAfterFirstUnstake = operatorBalanceBeforeFirstUnstake
        .add(GENERAL_STAKE_AMOUNT)
        .add(FIRST_STAKE_REWARD);

      expect(expectedOperatorBalanceAfterFirstUnstake.toString()).to.equal(operatorBalanceAfterFirstUnstake.toString());

      // Withdraw removed stake
      await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 70]);
      await staking.connect(signers.operator).withdrawRemovedStake();
      const operatorBalanceAfterWithdrawingRemovedStake = await link.balanceOf(signers.operator.address);

      expect(expectedOperatorBalanceAfterFirstUnstake.add(GENERAL_STAKE_AMOUNT).toString()).to.equal(
        operatorBalanceAfterWithdrawingRemovedStake.toString(),
      );
    });
  });
});
