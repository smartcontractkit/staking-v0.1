import hre, { ethers } from 'hardhat';
import { expect } from 'chai';
import { Signers } from '../types';
import {
  RewardLib,
  Staking,
  LinkToken,
  StakingPoolLib,
  MockMigrationTarget,
  MockMigrationTarget__factory,
} from '../typechain';
import {
  DUMMY_ADDRESS,
  GENERAL_STAKE_AMOUNT,
  INITIAL_MAX_OPERATOR_STAKE,
  INITIAL_MAX_POOL_SIZE,
  INITIAL_MAX_COMMUNITY_STAKE,
  INITIAL_MIN_OPERATOR_STAKE,
  INITIAL_MIN_COMMUNITY_STAKE,
  INITIAL_START_TIMESTAMP,
  REWARD_PRECISION,
  REWARD_AMOUNT,
  REWARD_DURATION,
  REWARD_RATE,
  setupContracts,
  SEVEN_DAYS,
  ONE_MONTH,
  MAX_POOL_SIZE,
  MULTIPLIER,
  LOW_REWARD_RATE,
  HIGH_REWARD_RATE,
  MIN_INITIAL_OPERATOR_COUNT,
} from './utils/setup';
import { getDelegationReward, getBaseReward } from './utils/rewards';
import { EMPTY_MERKLE_ROOT, TEST_MERKLE_ROOT } from './utils/mockdata';
import { BigNumber } from 'ethers';
import { getTxTimestamp } from './utils/helpers';
import { getEncodedMerkleProof } from './utils/merkleTree';
import { MockContract } from 'ethereum-waffle';
import { deployMockLinkTokenReceiver } from './lib/mocks/mockInvalidLinkTokenReceiver';

describe('Staking - owner', function () {
  let signers: Signers;
  let staking: Staking;
  let link: LinkToken;
  let rewardLib: RewardLib;
  let stakingPoolLib: StakingPoolLib;
  let stakingV1: MockMigrationTarget;
  let stakingV2: MockMigrationTarget;
  let invalidLinkTokenReceiver: MockContract;
  let proof: string;

  beforeEach(async function () {
    const config = await setupContracts();
    signers = config.signers;
    staking = config.staking;
    link = config.link;
    rewardLib = config.rewardLib;
    stakingPoolLib = config.stakingPoolLib;
    proof = getEncodedMerkleProof(config.merkleTree, signers.communityStaker.address);
    stakingV1 = await new MockMigrationTarget__factory(signers.owner).deploy();
    stakingV2 = await new MockMigrationTarget__factory(signers.owner).deploy();
    invalidLinkTokenReceiver = await deployMockLinkTokenReceiver(signers.owner);
  });

  describe('#setMerkleRoot', function () {
    describe('when called by owner', function () {
      it('allows updates', async function () {
        await staking.connect(signers.owner).setMerkleRoot(TEST_MERKLE_ROOT);
        expect(await staking.getMerkleRoot()).to.equal(TEST_MERKLE_ROOT);
      });

      it('emits MerkleRootChanged event', async function () {
        await expect(staking.connect(signers.owner).setMerkleRoot(TEST_MERKLE_ROOT)).to.emit(
          staking,
          'MerkleRootChanged',
        );
      });

      describe('when set to empty root', function () {
        it('gets correctly set to the empty root', async function () {
          await staking.connect(signers.owner).setMerkleRoot(EMPTY_MERKLE_ROOT);
          expect(await staking.getMerkleRoot()).to.equal(EMPTY_MERKLE_ROOT);
        });
      });
    });

    describe('when called by non-owner accounts', function () {
      it('does not allow updates ', async function () {
        await expect(staking.connect(signers.other).setMerkleRoot(TEST_MERKLE_ROOT)).to.be.revertedWith(
          'Only callable by owner',
        );
      });
    });
  });

  describe('#addOperators', function () {
    it('emits an OperatorAdded event', async function () {
      await expect(staking.addOperators([signers.operator.address]))
        .to.emit(stakingPoolLib.attach(staking.address), 'OperatorAdded')
        .withArgs(signers.operator.address);
    });

    describe('when adding duplicate operator', function () {
      it('reverts', async function () {
        await expect(staking.addOperators([signers.operator.address, signers.operator.address])).to.be.revertedWith(
          `OperatorAlreadyExists("${signers.operator.address}")`,
        );
      });
    });

    describe('when pool is open', function () {
      beforeEach(async function () {
        await staking.connect(signers.owner).addOperators(signers.defaultOperators);
        await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
        await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);
      });

      describe('when adding a staker with existing stake', function () {
        it('reverts', async function () {
          await link
            .connect(signers.communityStaker)
            .transferAndCall(staking.address, INITIAL_MIN_COMMUNITY_STAKE, proof);
          await expect(staking.addOperators([signers.communityStaker.address])).to.be.revertedWith(
            `ExistingStakeFound("${signers.communityStaker.address}")`,
          );
        });
      });

      describe('when operator stakes and is removed', function () {
        beforeEach(async function () {
          await link.connect(signers.operator).transferAndCall(staking.address, GENERAL_STAKE_AMOUNT, []);
          await staking.connect(signers.owner).removeOperators([signers.operator.address]);
        });

        describe('when removed operator is being readded', function () {
          it('reverts', async function () {
            await expect(staking.connect(signers.owner).addOperators([signers.operator.address])).to.be.revertedWith(
              `OperatorIsLocked("${signers.operator.address}")`,
            );
          });
        });
      });

      describe('when pool concludes', function () {
        beforeEach(async function () {
          await staking.connect(signers.owner).conclude();
        });

        it('reverts', async function () {
          await expect(staking.addOperators([signers.alice.address])).to.be.revertedWith(
            `InvalidPoolStatus(false, true)`,
          );
        });
      });
    });

    describe('when pool is empty', function () {
      describe('when there are operators added', function () {
        const customOperatorMaxStake = INITIAL_MAX_OPERATOR_STAKE.mul(16);

        beforeEach(async function () {
          await staking.connect(signers.owner).addOperators(signers.defaultOperators);
          await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
          await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);
          await staking
            .connect(signers.owner)
            .setPoolConfig(INITIAL_MAX_POOL_SIZE, INITIAL_MAX_COMMUNITY_STAKE, customOperatorMaxStake);
        });

        describe('when adding too many operators', function () {
          it('reverts', async function () {
            await expect(staking.connect(signers.owner).addOperators([signers.other.address])).to.be.revertedWith(
              `InsufficientRemainingPoolSpace(${INITIAL_MAX_OPERATOR_STAKE.mul(4)}, ${customOperatorMaxStake})`,
            );
          });
        });
      });
    });

    describe('when pool is not empty', function () {
      describe('when there are are operators added', function () {
        const newMaxOperatorStake = ethers.utils.parseUnits('800000', 18);

        beforeEach(async function () {
          await staking.connect(signers.owner).addOperators(signers.defaultOperators);
          await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
          await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);
          await staking
            .connect(signers.owner)
            .setPoolConfig(INITIAL_MAX_POOL_SIZE, INITIAL_MAX_COMMUNITY_STAKE, newMaxOperatorStake);
          await link.connect(signers.communityStaker).transferAndCall(staking.address, GENERAL_STAKE_AMOUNT, proof);
        });

        describe('when adding too many operators', function () {
          it('reverts', async function () {
            await expect(staking.addOperators([signers.other.address])).to.be.revertedWith(
              `InsufficientRemainingPoolSpace(${ethers.utils.parseUnits('199000', 18)}, ${newMaxOperatorStake})`,
            );
          });
        });
      });
    });
  });

  describe('#removeOperators', function () {
    beforeEach(async function () {
      await Promise.all([
        link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT),
        staking.connect(signers.owner).addOperators(signers.defaultOperators),
      ]);
    });

    describe('when pool is open', function () {
      beforeEach(async function () {
        await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP]);
        await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);
      });

      it('emits an OperatorRemoved event', async function () {
        await expect(staking.removeOperators([signers.operator.address]))
          .to.emit(stakingPoolLib.attach(staking.address), 'OperatorRemoved')
          .withArgs(signers.operator.address, '0');
      });

      it('an operator is removed', async function () {
        await staking.removeOperators([signers.operator.address]);
        expect(await staking.isOperator(signers.operator.address)).to.equal(false);
      });

      describe('when trying to remove an address that is not an operator', function () {
        it('reverts', async function () {
          await expect(staking.removeOperators([signers.other.address])).to.be.revertedWith(
            `OperatorDoesNotExist("${signers.other.address}")`,
          );
        });
      });

      describe('when pool is full', function () {
        beforeEach(async function () {
          await staking
            .connect(signers.owner)
            .setPoolConfig(
              INITIAL_MAX_POOL_SIZE,
              INITIAL_MAX_COMMUNITY_STAKE,
              INITIAL_MAX_POOL_SIZE.div(MIN_INITIAL_OPERATOR_COUNT),
            );
        });

        it('allows replacing an operator', async function () {
          await staking.connect(signers.owner).removeOperators([signers.operator.address]);
          await staking.connect(signers.owner).addOperators([signers.operator.address]);
        });
      });

      describe('when multiple operators have rewards', function () {
        beforeEach(async function () {
          // Operator 1 stakes; for base rewards
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 1]);
          await link.connect(signers.operator).transferAndCall(staking.address, INITIAL_MIN_OPERATOR_STAKE, []);

          // Operator 2 stakes; for delegation rewards
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 2]);
          await link.connect(signers.operatorTwo).transferAndCall(staking.address, INITIAL_MIN_OPERATOR_STAKE, []);

          // Operator 3 stakes; for delegation rewards
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 3]);
          await link.connect(signers.operatorThree).transferAndCall(staking.address, INITIAL_MIN_OPERATOR_STAKE, []);

          // Tokenholder stakes; for delegation rewards
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 4]);
          await link
            .connect(signers.communityStaker)
            .transferAndCall(staking.address, INITIAL_MIN_COMMUNITY_STAKE, proof);

          // Wait for rewards to come into effect
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 7]);
          await hre.network.provider.send('evm_mine');
        });

        it("does not change other operators' rewards", async function () {
          // Delegation rewards are:
          // 1) Split evenly between the 3 NOPs who have staked
          // 2) Accrue rewards for 3 seconds (community staker staked at time T = 4 and it is now time T = 7)
          const expectedOperatorRewards = getDelegationReward({
            delegatesCount: 3,
            inputs: [{ amount: INITIAL_MIN_COMMUNITY_STAKE, seconds: 3 }],
          });

          expect(await staking.getDelegationReward(signers.operatorTwo.address)).to.equal(expectedOperatorRewards);

          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 10]);
          await hre.network.provider.send('evm_mine');

          const expectedOperatorRewardsTwo = getDelegationReward({
            delegatesCount: 3,
            inputs: [{ amount: INITIAL_MIN_COMMUNITY_STAKE, seconds: 6 }],
          });
          expect(await staking.getDelegationReward(signers.operatorTwo.address)).to.equal(expectedOperatorRewardsTwo);

          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 13]);
          await staking.connect(signers.owner).removeOperators([signers.operator.address]);

          const expectedOperatorRewardsThree = getDelegationReward({
            delegatesCount: 3,
            inputs: [{ amount: INITIAL_MIN_COMMUNITY_STAKE, seconds: 9 }],
          });
          expect(await staking.getDelegationReward(signers.operatorTwo.address)).to.equal(expectedOperatorRewardsThree);
          expect(await staking.getDelegationReward(signers.operator.address)).to.equal(0);
        });
      });

      describe('when operator has rewards', function () {
        beforeEach(async function () {
          // Operator stakes; for base rewards
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 1]);
          await link.connect(signers.operator).transferAndCall(staking.address, INITIAL_MIN_OPERATOR_STAKE, []);

          // Tokenholder stakes; for delegation rewards
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 2]);
          await link
            .connect(signers.communityStaker)
            .transferAndCall(staking.address, INITIAL_MIN_COMMUNITY_STAKE, proof);

          // Wait for rewards to come into effect
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 3]);
          await hre.network.provider.send('evm_mine');
        });

        it('clears principal', async function () {
          expect(await staking.getStake(signers.operator.address)).to.equal(INITIAL_MIN_OPERATOR_STAKE);

          await staking.connect(signers.owner).removeOperators([signers.operator.address]);

          expect(await staking.getStake(signers.operator.address)).to.equal('0');
        });

        it('clears base reward', async function () {
          expect(await staking.getBaseReward(signers.operator.address)).to.equal(
            getBaseReward({ stakeAmount: INITIAL_MIN_OPERATOR_STAKE, secondsStaked: 2, isTokenholder: false }),
          );

          await staking.connect(signers.owner).removeOperators([signers.operator.address]);

          expect(await staking.getBaseReward(signers.operator.address)).to.equal('0');
        });

        it('clears delegation reward', async function () {
          expect(await staking.getDelegationReward(signers.operator.address)).to.equal(
            getDelegationReward({ inputs: [{ amount: INITIAL_MIN_COMMUNITY_STAKE, seconds: 1 }] }),
          );

          await staking.connect(signers.owner).removeOperators([signers.operator.address]);

          expect(await staking.getDelegationReward(signers.operator.address)).to.equal('0');
        });

        it('unreserves rewards going to the removed Operator', async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 4]);
          await staking.connect(signers.owner).removeOperators([signers.operator.address]);

          const earnedBaseRewardsAfter = await staking.getEarnedBaseRewards();
          const communityStakerBaseReward = getBaseReward({
            stakeAmount: INITIAL_MIN_COMMUNITY_STAKE,
            secondsStaked: 2,
          });

          // only community staker base reward should remain
          expect(earnedBaseRewardsAfter).to.equal(communityStakerBaseReward);
        });

        it('emits an OperatorRemoved event with principal', async function () {
          await expect(staking.removeOperators([signers.operator.address]))
            .to.emit(stakingPoolLib.attach(staking.address), 'OperatorRemoved')
            .withArgs(signers.operator.address, INITIAL_MIN_OPERATOR_STAKE);
        });

        it('decrements delegates count', async function () {
          await staking.connect(signers.owner).removeOperators([signers.operator.address]);

          expect(await staking.getDelegatesCount()).to.equal('0');
        });

        describe('when operator is on feed', function () {
          beforeEach(async function () {
            await staking.connect(signers.owner).setFeedOperators([signers.operator.address]);
          });

          it('reverts', async function () {
            await expect(staking.connect(signers.owner).removeOperators([signers.operator.address])).to.be.revertedWith(
              `OperatorIsAssignedToFeed("${signers.operator.address}")`,
            );
          });
        });
      });
    });

    describe('when pool is closed', function () {
      beforeEach(async function () {
        await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);
        await staking.connect(signers.owner).conclude();
      });

      it('reverts', async function () {
        await expect(staking.connect(signers.owner).removeOperators([signers.operator.address])).to.be.revertedWith(
          `InvalidPoolStatus(false, true)`,
        );
      });
    });
  });

  describe('#withdrawRemovedStake', function () {
    beforeEach(async function () {
      await Promise.all([
        link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT),
        staking.connect(signers.owner).addOperators(signers.defaultOperators),
      ]);
    });

    describe('when pool is open', function () {
      beforeEach(async function () {
        await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP]);
        await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);
      });

      describe('when operator has rewards', function () {
        beforeEach(async function () {
          // Operator stakes; for base rewards
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 1]);
          await link.connect(signers.operator).transferAndCall(staking.address, INITIAL_MIN_OPERATOR_STAKE, []);

          // Tokenholder stakes; for delegation rewards
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 2]);
          await link
            .connect(signers.communityStaker)
            .transferAndCall(staking.address, INITIAL_MIN_COMMUNITY_STAKE, proof);

          // Wait for rewards to come into effect
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 3]);
          await hre.network.provider.send('evm_mine');
        });

        describe('when operator is removed', function () {
          beforeEach(async function () {
            await staking.connect(signers.owner).removeOperators([signers.operator.address]);
          });

          it('total staked amount should be decreased by operator’s removed principal', async function () {
            expect(await staking.getTotalStakedAmount()).to.equal(INITIAL_MIN_COMMUNITY_STAKE);
          });

          it('total removed amount should be increased by operator’s removed principal', async function () {
            expect(await staking.getTotalRemovedAmount()).to.equal(INITIAL_MIN_OPERATOR_STAKE);
          });

          describe('when operator attempts to withdraw', function () {
            it('reverts', async function () {
              await expect(staking.connect(signers.operator).withdrawRemovedStake()).to.be.revertedWith(
                'InvalidPoolStatus(true, false)',
              );
            });
          });

          describe('when pool is closed', function () {
            beforeEach(async function () {
              await staking.connect(signers.owner).conclude();
            });

            describe('when operator withdraws', function () {
              it('emits an event', async function () {
                await expect(staking.connect(signers.operator).withdrawRemovedStake())
                  .to.emit(staking, 'Unstaked')
                  .withArgs(signers.operator.address, INITIAL_MIN_OPERATOR_STAKE, 0, 0);
              });

              it('the operator’s principal amount in LINK is transferred from the staking pool', async function () {
                const stakingPoolLINKBalanceBefore = await link.balanceOf(staking.address);
                await staking.connect(signers.operator).withdrawRemovedStake();
                const stakingPoolLINKBalanceAfter = await link.balanceOf(staking.address);
                expect(stakingPoolLINKBalanceBefore.sub(stakingPoolLINKBalanceAfter)).to.equal(
                  INITIAL_MIN_OPERATOR_STAKE,
                );
              });

              it('the operator’s principal amount in LINK is transferred to the operator', async function () {
                const operatorLINKBalanceBefore = await link.balanceOf(signers.operator.address);
                await staking.connect(signers.operator).withdrawRemovedStake();
                const operatorLINKBalanceAfter = await link.balanceOf(signers.operator.address);
                expect(operatorLINKBalanceAfter.sub(operatorLINKBalanceBefore)).to.equal(INITIAL_MIN_OPERATOR_STAKE);
              });

              it('total removed amount should decrease by operator’s principal', async function () {
                const totalRemovedAmountBefore = await staking.getTotalRemovedAmount();
                await staking.connect(signers.operator).withdrawRemovedStake();
                const totalRemovedAmountAfter = await staking.getTotalRemovedAmount();
                expect(totalRemovedAmountBefore.sub(totalRemovedAmountAfter)).to.equal(INITIAL_MIN_OPERATOR_STAKE);
              });

              describe('when operator attempts to withdraw again', function () {
                beforeEach(async function () {
                  await staking.connect(signers.operator).withdrawRemovedStake();
                });

                it('reverts', async function () {
                  await expect(staking.connect(signers.operator).withdrawRemovedStake()).to.be.revertedWith(
                    `StakeNotFound("${signers.operator.address}")`,
                  );
                });
              });
            });
          });
        });
      });
    });
  });

  describe('#setPoolConfig', function () {
    describe('when pool is open', function () {
      beforeEach(async function () {
        await staking.connect(signers.owner).addOperators(signers.defaultOperators);
        await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
        await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP]);
        await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);
      });

      describe('when pool size is increased', function () {
        it('pool size is updated and emits event', async function () {
          const newPoolSize = INITIAL_MAX_POOL_SIZE.mul(2);

          const tx = await staking
            .connect(signers.owner)
            .setPoolConfig(newPoolSize, INITIAL_MAX_COMMUNITY_STAKE, INITIAL_MAX_OPERATOR_STAKE);
          await expect(tx).to.emit(stakingPoolLib.attach(staking.address), 'PoolSizeIncreased').withArgs(newPoolSize);

          expect(await staking.connect(signers.other).getMaxPoolSize()).to.equal(newPoolSize);
        });
      });

      describe('when Operator stake size is increased', function () {
        it('updates the Operator stake size and emits an event', async function () {
          const newMaxOperatorStake = INITIAL_MAX_OPERATOR_STAKE.mul(2);
          const tx = await staking
            .connect(signers.owner)
            .setPoolConfig(INITIAL_MAX_POOL_SIZE, INITIAL_MAX_COMMUNITY_STAKE, newMaxOperatorStake);
          await expect(tx)
            .to.emit(stakingPoolLib.attach(staking.address), 'MaxOperatorStakeAmountIncreased')
            .withArgs(newMaxOperatorStake);

          const newOperatorLimits = await staking.connect(signers.other).getOperatorLimits();
          expect(newOperatorLimits[1]).to.equal(newMaxOperatorStake);
        });

        describe('when reserved pool space goes over the remaining pool space', function () {
          it('reverts', async function () {
            const newMaxOperatorStake = INITIAL_MAX_OPERATOR_STAKE.mul(17);
            await expect(
              staking
                .connect(signers.owner)
                .setPoolConfig(INITIAL_MAX_POOL_SIZE, INITIAL_MAX_COMMUNITY_STAKE, newMaxOperatorStake),
            ).to.be.revertedWith(`InvalidMaxStakeAmount(${newMaxOperatorStake})`);
          });
        });

        describe('max Operator stake size is over the maximum pool size', function () {
          it('reverts', async function () {
            const newMaxOperatorStake = INITIAL_MAX_POOL_SIZE.add(1);
            await expect(
              staking
                .connect(signers.owner)
                .setPoolConfig(INITIAL_MAX_POOL_SIZE, INITIAL_MAX_COMMUNITY_STAKE, newMaxOperatorStake),
            ).to.be.revertedWith(`InvalidMaxStakeAmount(${newMaxOperatorStake})`);
          });
        });
      });

      describe('when max community staker stake size is increased', function () {
        it('updates the max community staker stake size and emits an event', async function () {
          const newMaxCommunityStake = INITIAL_MAX_COMMUNITY_STAKE.mul(2);

          const tx = await staking
            .connect(signers.owner)
            .setPoolConfig(INITIAL_MAX_POOL_SIZE, newMaxCommunityStake, INITIAL_MAX_OPERATOR_STAKE);
          await expect(tx)
            .to.emit(stakingPoolLib.attach(staking.address), 'MaxCommunityStakeAmountIncreased')
            .withArgs(newMaxCommunityStake);

          const newCommunityStakerLimits = await staking.connect(signers.other).getCommunityStakerLimits();
          expect(newCommunityStakerLimits[1]).to.equal(newMaxCommunityStake);
        });
      });

      describe('when pool size is decreased', function () {
        it('pool configuration is NOT updated', async function () {
          const newPoolSize = INITIAL_MAX_POOL_SIZE.div(2);
          const newMaxCommunityStake = INITIAL_MAX_COMMUNITY_STAKE;
          const newMaxOperatorStake = INITIAL_MAX_OPERATOR_STAKE;

          await expect(
            staking.connect(signers.owner).setPoolConfig(newPoolSize, newMaxCommunityStake, newMaxOperatorStake),
          ).to.be.revertedWith(`InvalidPoolSize(${newPoolSize})`);
        });
      });

      describe('when max community staker stake amount is decreased', function () {
        it('pool configuration is NOT updated', async function () {
          const newPoolSize = INITIAL_MAX_POOL_SIZE;
          const newMaxCommunityStake = INITIAL_MAX_COMMUNITY_STAKE.div(2);
          const newMaxOperatorStake = INITIAL_MAX_OPERATOR_STAKE;

          await expect(
            staking.connect(signers.owner).setPoolConfig(newPoolSize, newMaxCommunityStake, newMaxOperatorStake),
          ).to.be.revertedWith(`InvalidMaxStakeAmount(${newMaxCommunityStake})`);
        });
      });

      describe('when max community staker stake amount is decreased', function () {
        it('pool configuration is NOT updated', async function () {
          const newPoolSize = INITIAL_MAX_POOL_SIZE;
          const newMaxCommunityStake = INITIAL_MAX_COMMUNITY_STAKE;
          const newMaxOperatorStake = INITIAL_MAX_OPERATOR_STAKE.div(2);

          await expect(
            staking.connect(signers.owner).setPoolConfig(newPoolSize, newMaxCommunityStake, newMaxOperatorStake),
          ).to.be.revertedWith(`InvalidMaxStakeAmount(${newMaxOperatorStake})`);
        });
      });

      describe('when max pool size update causes reward duration to be over the minimum reward duration', function () {
        it('updates the pool size', async function () {
          const newPoolSize = INITIAL_MAX_POOL_SIZE.mul(2);
          const tx = await staking
            .connect(signers.owner)
            .setPoolConfig(newPoolSize, INITIAL_MAX_COMMUNITY_STAKE, INITIAL_MAX_OPERATOR_STAKE);
          await expect(tx).to.emit(stakingPoolLib.attach(staking.address), 'PoolSizeIncreased').withArgs(newPoolSize);

          expect(await staking.connect(signers.other).getMaxPoolSize()).to.equal(newPoolSize);
        });

        it('correctly extends the reward duration', async function () {
          const newPoolSize = INITIAL_MAX_POOL_SIZE.mul(2);
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 1]);
          await staking
            .connect(signers.owner)
            .setPoolConfig(newPoolSize, INITIAL_MAX_COMMUNITY_STAKE, INITIAL_MAX_OPERATOR_STAKE);
          const rewardDuration = REWARD_AMOUNT.div(REWARD_RATE).div(newPoolSize.div(REWARD_PRECISION));
          const [_, endTimestamp] = await staking.getRewardTimestamps();
          expect(endTimestamp).to.equal(rewardDuration.add(INITIAL_START_TIMESTAMP + 1));
        });
      });

      describe('when max pool size update causes reward duration to drop to under minimum reward duration', function () {
        it('reverts', async function () {
          await expect(
            staking
              .connect(signers.owner)
              .setPoolConfig(INITIAL_MAX_POOL_SIZE.mul(10), INITIAL_MAX_COMMUNITY_STAKE, INITIAL_MAX_OPERATOR_STAKE),
          ).to.be.revertedWith(`RewardDurationTooShort()`);
        });
      });
    });

    describe('when pool is closed', function () {
      beforeEach(async function () {
        await staking.connect(signers.owner).addOperators(signers.defaultOperators);
        await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP]);
        await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
      });

      it('reverts', async function () {
        await expect(
          staking
            .connect(signers.owner)
            .setPoolConfig(INITIAL_MAX_POOL_SIZE, INITIAL_MAX_COMMUNITY_STAKE, INITIAL_MAX_OPERATOR_STAKE),
        ).to.be.revertedWith(`InvalidPoolStatus(false, true)`);
      });
    });
  });

  describe('#setFeedOperators', function () {
    beforeEach(async function () {
      await staking.addOperators(signers.defaultOperators);
    });

    describe('when non-operator addresses are supplied', function () {
      it('reverts', async function () {
        await expect(staking.connect(signers.owner).setFeedOperators([signers.other.address])).to.be.revertedWith(
          `OperatorDoesNotExist("${signers.other.address}")`,
        );
      });
    });

    describe('when operator addresses are supplied', function () {
      describe('when operators have stake', function () {
        beforeEach(async function () {
          await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
          await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);
          await link.connect(signers.operator).transferAndCall(staking.address, GENERAL_STAKE_AMOUNT, []);
        });

        it('emits an event', async function () {
          const feedOperators = [signers.operator.address];
          await expect(staking.connect(signers.owner).setFeedOperators(feedOperators))
            .to.emit(stakingPoolLib.attach(staking.address), 'FeedOperatorsSet')
            .withArgs(feedOperators);
        });

        it('sets the list of on-feed operators', async function () {
          const feedOperators = [signers.operator.address];
          await staking.connect(signers.owner).setFeedOperators(feedOperators);
          expect(await staking.getFeedOperators()).to.deep.equal(feedOperators);
        });

        it('overwrites previous list of on-feed operators', async function () {
          const oldFeedOperators = [signers.operator.address];
          await staking.connect(signers.owner).setFeedOperators(oldFeedOperators);
          const newFeedOperators: string[] = [];
          await staking.connect(signers.owner).setFeedOperators(newFeedOperators);
          expect(await staking.getFeedOperators()).to.deep.equal(newFeedOperators);
        });

        describe('when duplicate operator addresses are supplied', function () {
          it('reverts', async function () {
            await expect(
              staking.connect(signers.owner).setFeedOperators([signers.operator.address, signers.operator.address]),
            ).to.be.revertedWith(`OperatorAlreadyExists("${signers.operator.address}")`);
          });
        });
      });
    });
  });

  describe('#start', function () {
    describe('when called before adding operators', function () {
      beforeEach(async function () {
        await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
      });

      it('reverts', async function () {
        await expect(staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE)).to.be.revertedWith(
          `InadequateInitialOperatorsCount(0, ${MIN_INITIAL_OPERATOR_COUNT})`,
        );
      });
    });

    describe('when called with an empty merkle root', function () {
      beforeEach(async function () {
        await staking.connect(signers.owner).addOperators(signers.defaultOperators);
        await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
        await staking.connect(signers.owner).setMerkleRoot(EMPTY_MERKLE_ROOT);
      });

      it('reverts', async function () {
        await expect(staking.start(REWARD_AMOUNT, REWARD_RATE)).to.be.revertedWith('MerkleRootNotSet()');
      });
    });

    describe('when called with the merkle root set', function () {
      describe('when called without LINK transfer approval', function () {
        beforeEach(async function () {
          await staking.connect(signers.owner).addOperators(signers.defaultOperators);
        });

        it('reverts', async function () {
          await expect(staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE)).to.be.reverted;
        });
      });

      describe('when called more than once', function () {
        beforeEach(async function () {
          await staking.connect(signers.owner).addOperators(signers.defaultOperators);
        });

        it('reverts', async function () {
          await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
          await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);

          await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
          await expect(staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE)).to.be.revertedWith(``);
        });
      });

      describe('when called with LINK transfer approval', function () {
        beforeEach(async function () {
          await staking.connect(signers.owner).addOperators(signers.defaultOperators);
          await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
        });

        it('increases the available rewards, sets the start and end timestamps', async function () {
          await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);

          const [startTimestamp, endTimestamp] = await staking.getRewardTimestamps();
          const rewardRate = await staking.getRewardRate();
          const maxPoolSize = await staking.getMaxPoolSize();
          const rewardDuration = REWARD_AMOUNT.div(rewardRate).div(maxPoolSize.div(REWARD_PRECISION));
          expect(rewardDuration).to.equal(REWARD_DURATION);
          const expectedEndTimestamp = startTimestamp.add(rewardDuration);

          expect(endTimestamp).to.equal(expectedEndTimestamp);
        });

        it('opens the pool', async function () {
          const tx = await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);

          const isActive = await staking.isActive();
          expect(isActive).to.equal(true);

          await expect(tx).to.emit(stakingPoolLib.attach(staking.address), 'PoolOpened');
        });

        it('transfers LINK to the staking contract', async function () {
          await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);

          const stakingLinkBalance = await link.balanceOf(staking.address);
          expect(stakingLinkBalance).to.equal(REWARD_AMOUNT);

          const availableRewardBalance = await staking.getAvailableReward();
          expect(availableRewardBalance).to.equal(REWARD_AMOUNT);
        });

        it('emits an event', async function () {
          const tx = await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);

          const [startTimestamp, endTimestamp] = await staking.getRewardTimestamps();
          const rewardRate = await staking.getRewardRate();

          await expect(tx)
            .to.emit(rewardLib.attach(staking.address), 'RewardInitialized')
            .withArgs(rewardRate, REWARD_AMOUNT, startTimestamp, endTimestamp);
        });

        describe('when called with an insufficient reward amount (less than minimum reward duration)', function () {
          it('reverts', async function () {
            await expect(staking.connect(signers.owner).start(REWARD_AMOUNT.div(10), REWARD_RATE)).to.be.revertedWith(
              `RewardDurationTooShort()`,
            );
          });
        });
      });
    });
  });

  describe('#conclude', function () {
    beforeEach(async function () {
      await staking.connect(signers.owner).addOperators(signers.defaultOperators);
    });

    describe('when pool started', function () {
      beforeEach(async function () {
        await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
        await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);
      });

      describe('when staking is concluded', function () {
        it('stops rewards accumulation', async function () {
          await staking.connect(signers.owner).conclude();
          const rewardBefore = await staking.getEarnedBaseRewards();
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP]);
          await hre.network.provider.send('evm_mine');
          const rewardAfter = await staking.getEarnedBaseRewards();
          expect(rewardAfter).to.equal(rewardBefore);
        });

        it('closes the pool', async function () {
          await staking.connect(signers.owner).conclude();
          const isActive = await staking.isActive();
          expect(isActive).to.equal(false);
        });

        it('emits a PoolConcluded event', async function () {
          await expect(staking.connect(signers.owner).conclude()).to.emit(
            stakingPoolLib.attach(staking.address),
            'PoolConcluded',
          );
        });

        describe('after over a month', async function () {
          beforeEach(async function () {
            await hre.network.provider.send('evm_increaseTime', [REWARD_DURATION - 10]); // deduct a small time buffer to avoid hitting reward expiry
            await hre.network.provider.send('evm_mine');
          });

          it('closes the pool', async function () {
            await staking.connect(signers.owner).conclude();
            const isActive = await staking.isActive();
            expect(isActive).to.equal(false);
          });
        });
      });

      describe('when attempting to conclude again', function () {
        it('reverts', async function () {
          await staking.connect(signers.owner).conclude();
          await expect(staking.connect(signers.owner).conclude()).to.be.revertedWith('InvalidPoolStatus(false, true)');
        });
      });
    });

    describe('when pool not started', function () {
      describe('when attempting to conclude', function () {
        it('reverts', async function () {
          await expect(staking.connect(signers.owner).conclude()).to.be.revertedWith('InvalidPoolStatus(false, true)');
        });
      });
    });
  });

  describe('#withdrawUnusedReward', function () {
    beforeEach(async function () {
      await staking.connect(signers.owner).addOperators(signers.defaultOperators);
    });

    describe('when pool started', function () {
      beforeEach(async function () {
        await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
        await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP]);
        await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);
      });

      it('reverts', async function () {
        await expect(staking.connect(signers.owner).withdrawUnusedReward()).to.be.revertedWith(
          'InvalidPoolStatus(true, false)',
        );
      });

      describe('when staking is concluded', function () {
        beforeEach(async function () {
          await staking.connect(signers.owner).conclude();
        });

        it('reduces the available rewards by the unused amount', async function () {
          await staking.connect(signers.owner).withdrawUnusedReward();

          const availableAfter = await staking.getAvailableReward();
          // We expect it to be 0 as all the available rewards get transferred out of the contract when there are no stakers.
          expect(availableAfter).to.equal('0');
        });

        it('transfers the unused LINK reward to the owner address', async function () {
          // Calculate before balances
          const ownerLinkBalanceBefore = await link.balanceOf(signers.owner.address);
          const stakingContractBalanceBefore = await link.balanceOf(staking.address);
          const available = await staking.getAvailableReward();

          // Conclude pool
          await staking.connect(signers.owner).withdrawUnusedReward();

          // Get expected unused
          const earnedBaseReward = await staking.getEarnedBaseRewards();
          const unusedRewards = available.sub(earnedBaseReward);

          // Validate balances
          const ownerLinkBalanceAfter = await link.balanceOf(signers.owner.address);
          const stakingContractBalanceAfter = await link.balanceOf(staking.address);
          expect(ownerLinkBalanceAfter.sub(ownerLinkBalanceBefore)).to.equal(unusedRewards);
          expect(stakingContractBalanceBefore.sub(stakingContractBalanceAfter)).to.equal(unusedRewards);
        });

        it('emits a RewardWithdrawn event', async function () {
          const available = await staking.getAvailableReward();
          // We expect all available rewards to be released as there are no stakers
          await expect(staking.connect(signers.owner).withdrawUnusedReward())
            .to.emit(rewardLib.attach(staking.address), 'RewardWithdrawn')
            .withArgs(available);
        });
      });

      describe('when reward is expired', function () {
        beforeEach(async function () {
          const [_, endTimestamp] = await staking.connect(signers.owner).getRewardTimestamps();
          await hre.ethers.provider.send('evm_setNextBlockTimestamp', [endTimestamp.toNumber() + 1]);
        });

        it('reduces the available rewards by the unused amount', async function () {
          await staking.connect(signers.owner).withdrawUnusedReward();

          const availableAfter = await staking.getAvailableReward();
          // We expect it to be 0 as all the available rewards get transferred out of the contract when there are no stakers.
          expect(availableAfter).to.equal('0');
        });

        it('transfers the unused LINK reward to the owner address', async function () {
          // Calculate before balances
          const ownerLinkBalanceBefore = await link.balanceOf(signers.owner.address);
          const stakingContractBalanceBefore = await link.balanceOf(staking.address);
          const available = await staking.getAvailableReward();

          // Conclude pool
          await staking.connect(signers.owner).withdrawUnusedReward();

          // Get expected unused
          const earnedBaseReward = await staking.getEarnedBaseRewards();
          const unusedRewards = available.sub(earnedBaseReward);

          // Validate balances
          const ownerLinkBalanceAfter = await link.balanceOf(signers.owner.address);
          const stakingContractBalanceAfter = await link.balanceOf(staking.address);
          expect(ownerLinkBalanceAfter.sub(ownerLinkBalanceBefore)).to.equal(unusedRewards);
          expect(stakingContractBalanceBefore.sub(stakingContractBalanceAfter)).to.equal(unusedRewards);
        });

        it('emits a RewardWithdrawn event', async function () {
          const available = await staking.getAvailableReward();
          // We expect all available rewards to be released as there are no stakers
          await expect(staking.connect(signers.owner).withdrawUnusedReward())
            .to.emit(rewardLib.attach(staking.address), 'RewardWithdrawn')
            .withArgs(available);
        });
      });

      describe('when operator and community staker staked', function () {
        beforeEach(async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 1]);
          await link.connect(signers.operator).transferAndCall(staking.address, INITIAL_MIN_OPERATOR_STAKE, proof);

          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 2]);
          await link
            .connect(signers.communityStaker)
            .transferAndCall(staking.address, INITIAL_MIN_COMMUNITY_STAKE, proof);
        });

        it('reduces the available rewards', async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 3]);
          await staking.connect(signers.owner).conclude();

          const operatorBalanceBefore = await link.balanceOf(signers.operator.address);
          await staking.connect(signers.operator).unstake();
          const operatorBalanceAfter = await link.balanceOf(signers.operator.address);

          const earnedOperatorBaseReward = getBaseReward({
            stakeAmount: INITIAL_MIN_OPERATOR_STAKE,
            secondsStaked: 2,
            isTokenholder: false,
          });
          const earnedOperatorDelegationReward = getDelegationReward({
            inputs: [{ amount: INITIAL_MIN_COMMUNITY_STAKE, seconds: 1 }],
          });

          expect(operatorBalanceAfter.sub(operatorBalanceBefore).toString()).to.equal(
            earnedOperatorBaseReward.add(earnedOperatorDelegationReward).add(INITIAL_MIN_OPERATOR_STAKE).toString(),
          );

          const stakerBalanceBefore = await link.balanceOf(signers.communityStaker.address);
          await staking.connect(signers.communityStaker).unstake();
          const stakerBalanceAfter = await link.balanceOf(signers.communityStaker.address);

          const earnedBaseReward = getBaseReward({ stakeAmount: INITIAL_MIN_COMMUNITY_STAKE, secondsStaked: 1 });

          expect(stakerBalanceAfter.sub(stakerBalanceBefore).toString()).to.equal(
            earnedBaseReward.add(INITIAL_MIN_COMMUNITY_STAKE).toString(),
          );

          await staking.connect(signers.owner).withdrawUnusedReward();

          const availableAfter = await staking.getAvailableReward();
          // We expect it to be 0 as all the available rewards get transferred out of the contract when there are no stakers.
          expect(availableAfter).to.equal('0');
        });
      });

      describe('when community staker and operator staked', function () {
        beforeEach(async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 1]);
          await link
            .connect(signers.communityStaker)
            .transferAndCall(staking.address, INITIAL_MIN_COMMUNITY_STAKE, proof);

          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 2]);
          await link.connect(signers.operator).transferAndCall(staking.address, INITIAL_MIN_OPERATOR_STAKE, proof);
        });

        it('reduces the available rewards', async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 3]);
          await staking.connect(signers.owner).conclude();

          const operatorBalanceBefore = await link.balanceOf(signers.operator.address);
          await staking.connect(signers.operator).unstake();
          const operatorBalanceAfter = await link.balanceOf(signers.operator.address);

          const earnedOperatorBaseReward = getBaseReward({
            stakeAmount: INITIAL_MIN_OPERATOR_STAKE,
            secondsStaked: 1,
            isTokenholder: false,
          });
          const earnedOperatorDelegationReward = getDelegationReward({
            inputs: [{ amount: INITIAL_MIN_COMMUNITY_STAKE, seconds: 1 }],
          });

          expect(operatorBalanceAfter.sub(operatorBalanceBefore).toString()).to.equal(
            earnedOperatorBaseReward.add(earnedOperatorDelegationReward).add(INITIAL_MIN_OPERATOR_STAKE).toString(),
          );

          const stakerBalanceBefore = await link.balanceOf(signers.communityStaker.address);
          await staking.connect(signers.communityStaker).unstake();
          const stakerBalanceAfter = await link.balanceOf(signers.communityStaker.address);

          const earnedBaseReward = getBaseReward({ stakeAmount: INITIAL_MIN_COMMUNITY_STAKE, secondsStaked: 2 });

          expect(stakerBalanceAfter.sub(stakerBalanceBefore).toString()).to.equal(
            earnedBaseReward.add(INITIAL_MIN_COMMUNITY_STAKE).toString(),
          );

          await staking.connect(signers.owner).withdrawUnusedReward();

          const availableAfter = await staking.getAvailableReward();
          // We expect it to be 0 as all the available rewards get transferred out of the contract when there are no stakers.
          expect(availableAfter).to.equal('0');
        });
      });

      // This is an acknowledge edge-case - this shouldn't really happen in
      // practice and, if it does, there are operational workarounds to
      // unreserve those rewards.
      describe.skip('when only community stake exists', function () {
        beforeEach(async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 1]);
          await link
            .connect(signers.communityStaker)
            .transferAndCall(staking.address, INITIAL_MIN_COMMUNITY_STAKE, proof);
        });

        it('reduces the available rewards', async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 2]);
          await staking.connect(signers.owner).conclude();

          const stakerBalanceBefore = await link.balanceOf(signers.communityStaker.address);
          await staking.connect(signers.communityStaker).unstake();
          const stakerBalanceAfter = await link.balanceOf(signers.communityStaker.address);

          const earnedBaseReward = getBaseReward({ stakeAmount: INITIAL_MIN_COMMUNITY_STAKE, secondsStaked: 1 });

          expect(stakerBalanceAfter.sub(stakerBalanceBefore).toString()).to.equal(
            earnedBaseReward.add(INITIAL_MIN_COMMUNITY_STAKE).toString(),
          );

          await staking.connect(signers.owner).withdrawUnusedReward();

          const availableAfter = await staking.getAvailableReward();
          // We expect it to be 0 as all the available rewards get transferred out of the contract when there are no stakers.
          expect(availableAfter).to.equal('0');
        });
      });
    });

    describe('when pool not started', function () {
      it('reduces the available rewards by the unused amount', async function () {
        await staking.connect(signers.owner).withdrawUnusedReward();

        const availableAfter = await staking.getAvailableReward();
        // We expect it to be 0 as all the available rewards get transferred out of the contract when there are no stakers.
        expect(availableAfter).to.equal('0');
      });

      it('transfers the unused LINK reward to the owner address', async function () {
        // Calculate before balances
        const ownerLinkBalanceBefore = await link.balanceOf(signers.owner.address);
        const stakingContractBalanceBefore = await link.balanceOf(staking.address);
        const available = await staking.getAvailableReward();

        // Conclude pool
        await staking.connect(signers.owner).withdrawUnusedReward();

        // Get expected unused
        const earnedBaseReward = await staking.getEarnedBaseRewards();
        const unusedRewards = available.sub(earnedBaseReward);

        // Validate balances
        const ownerLinkBalanceAfter = await link.balanceOf(signers.owner.address);
        const stakingContractBalanceAfter = await link.balanceOf(staking.address);
        expect(ownerLinkBalanceAfter.sub(ownerLinkBalanceBefore)).to.equal(unusedRewards);
        expect(stakingContractBalanceBefore.sub(stakingContractBalanceAfter)).to.equal(unusedRewards);
      });

      it('emits a RewardWithdrawn event', async function () {
        const available = await staking.getAvailableReward();
        // We expect all available rewards to be released as there are no stakers
        await expect(staking.connect(signers.owner).withdrawUnusedReward())
          .to.emit(rewardLib.attach(staking.address), 'RewardWithdrawn')
          .withArgs(available);
      });
    });
  });

  describe('#addReward', function () {
    describe('when pool is closed', function () {
      it('reverts', async function () {
        await expect(staking.connect(signers.owner).addReward(REWARD_AMOUNT)).to.be.revertedWith(
          'InvalidPoolStatus(false, true)',
        );
      });
    });

    describe('when pool is open', function () {
      beforeEach(async function () {
        await staking.connect(signers.owner).addOperators(signers.defaultOperators);
        await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
        await hre.ethers.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP]);
        await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);
      });

      describe('when LINK transfer has been approved', function () {
        beforeEach(async function () {
          await hre.ethers.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 1]);
          await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
        });

        it('transfers LINK to the staking contract', async function () {
          const stakingPoolLINKBalanceBefore = await link.balanceOf(staking.address);
          await staking.connect(signers.owner).addReward(REWARD_AMOUNT);
          const stakingPoolLINKBalanceAfter = await link.balanceOf(staking.address);
          expect(stakingPoolLINKBalanceAfter.sub(stakingPoolLINKBalanceBefore)).to.equal(REWARD_AMOUNT);
        });

        it('updates the available rewards balance', async function () {
          const stakingPoolAvailableRewardsBefore = await staking.getAvailableReward();
          await staking.connect(signers.owner).addReward(REWARD_AMOUNT);
          const stakingPoolAvailableRewardsAfter = await staking.getAvailableReward();
          expect(stakingPoolAvailableRewardsAfter.sub(stakingPoolAvailableRewardsBefore)).to.equal(REWARD_AMOUNT);
        });

        it('correctly extends the reward end time', async function () {
          await hre.ethers.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 2]);
          await staking.connect(signers.owner).addReward(REWARD_AMOUNT);

          // The pool initially had "REWARD_AMOUNT" available rewards and we are now adding
          // another "REWARD_AMOUNT" tokens to it.
          const increasedAvailableRewardAmount = REWARD_AMOUNT.mul(2);
          const rewardDuration = increasedAvailableRewardAmount
            .div(REWARD_RATE)
            .div(INITIAL_MAX_POOL_SIZE.div(REWARD_PRECISION));

          const [_, endTimestamp] = await staking.getRewardTimestamps();
          expect(endTimestamp).to.equal(rewardDuration.add(INITIAL_START_TIMESTAMP + 2));
        });

        it('should emit an event', async function () {
          await expect(staking.connect(signers.owner).addReward(REWARD_AMOUNT))
            .to.emit(rewardLib.attach(staking.address), 'RewardAdded')
            .withArgs(REWARD_AMOUNT);
        });

        describe('when pool has stakers', function () {
          beforeEach(async function () {
            await ethers.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 2]);
            await link.connect(signers.operator).transferAndCall(staking.address, INITIAL_MIN_OPERATOR_STAKE, []);
          });

          describe('when reward is about to expire', function () {
            let latestBlockTimestamp = 0;

            beforeEach(async function () {
              const [_, endTimestamp] = await staking.getRewardTimestamps();
              latestBlockTimestamp = endTimestamp.toNumber() - 10;
              await hre.ethers.provider.send('evm_setNextBlockTimestamp', [latestBlockTimestamp]);
            });

            it('correctly extends the reward duration', async function () {
              const currentAvailableRewards = await staking.getAvailableReward();
              const earnedBaseRewards = getBaseReward({
                isTokenholder: false,
                stakeAmount: INITIAL_MIN_OPERATOR_STAKE,
                secondsStaked: latestBlockTimestamp - (INITIAL_START_TIMESTAMP + 2),
              });
              const earnedDelegatedRewards = 0; // No community staker's have staked

              // Try extend rewards by another month
              // 1) Calculate how much remaining available rewards is required to extend
              // the pool duration by 6 months.
              const additionalDuration = BigNumber.from(ONE_MONTH);
              const additionalRewards = BigNumber.from(MAX_POOL_SIZE)
                .mul(REWARD_RATE)
                .mul(1_000_000)
                .mul(additionalDuration);

              // 2) Remaining rewards
              const remainingRewards = currentAvailableRewards.sub(earnedBaseRewards).sub(earnedDelegatedRewards);
              const remainingAvailableDuration = remainingRewards.div(MAX_POOL_SIZE).div(REWARD_RATE).div(1_000_000);

              await staking.connect(signers.owner).addReward(additionalRewards);
              const [_, endTimestampAfter] = await staking.getRewardTimestamps();
              const targetEndTimestamp = BigNumber.from(latestBlockTimestamp)
                .add(remainingAvailableDuration)
                .add(additionalDuration);
              expect(endTimestampAfter).to.equal(targetEndTimestamp);
            });
          });
        });
      });

      describe('when LINK transfer has not been approved', function () {
        it('reverts', async function () {
          await expect(staking.connect(signers.owner).addReward(REWARD_AMOUNT)).to.be.reverted;
        });
      });
    });
  });

  describe('#changeRewardRate', function () {
    beforeEach(async function () {
      await staking.connect(signers.owner).addOperators(signers.defaultOperators);
      await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT.mul(10));
      await hre.ethers.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP]);
      await staking.connect(signers.owner).start(REWARD_AMOUNT.mul(10), REWARD_RATE);
    });

    it('sets the reward rate', async function () {
      const newRate = REWARD_RATE.div(2);
      await staking.connect(signers.owner).changeRewardRate(newRate);
      expect(await staking.getRewardRate()).to.equal(newRate);
    });

    it('emits an event', async function () {
      const newRate = REWARD_RATE.div(2);
      await expect(staking.connect(signers.owner).changeRewardRate(newRate))
        .to.emit(rewardLib.attach(staking.address), 'RewardRateChanged')
        .withArgs(newRate);
    });

    describe('when there are no stakers', async function () {
      describe('when the rate is reduced', function () {
        describe('when reduced to zero', async function () {
          it('reverts', async function () {
            await expect(staking.connect(signers.owner).changeRewardRate(0)).to.be.revertedWith('');
          });
        });

        it('increases the reward duration', async function () {
          const newRate = REWARD_RATE.div(2);
          const newRewardDuration = REWARD_AMOUNT.mul(10)
            .div(newRate)
            .div(BigNumber.from(MAX_POOL_SIZE).mul(MULTIPLIER).div(REWARD_PRECISION));
          await hre.ethers.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 1]);
          await staking.connect(signers.owner).changeRewardRate(newRate);
          const [_, endTimestamp] = await staking.getRewardTimestamps();
          expect(endTimestamp).to.equal(newRewardDuration.add(INITIAL_START_TIMESTAMP + 1));
        });
      });

      describe('when the rate is increased', function () {
        it('decreases the reward duration', async function () {
          const newRate = HIGH_REWARD_RATE;
          const newRewardDuration = REWARD_AMOUNT.mul(10)
            .div(newRate)
            .div(BigNumber.from(MAX_POOL_SIZE).mul(MULTIPLIER).div(REWARD_PRECISION));

          await hre.ethers.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 2]);
          await staking.connect(signers.owner).changeRewardRate(newRate);
          const [_, endTimestamp] = await staking.getRewardTimestamps();
          expect(endTimestamp).to.equal(newRewardDuration.add(INITIAL_START_TIMESTAMP + 2));
        });

        describe('when new reward duration is too short', function () {
          it('reverts', async function () {
            const newRate = REWARD_RATE.mul(100);
            await expect(staking.connect(signers.owner).changeRewardRate(newRate)).to.be.revertedWith(
              'RewardDurationTooShort()',
            );
          });
        });
      });
    });

    describe('when there are stakers, T1', function () {
      beforeEach(async function () {
        await hre.ethers.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 1]);
        await link.connect(signers.operator).transferAndCall(staking.address, GENERAL_STAKE_AMOUNT, []);
      });

      describe('when there are community stakers who have staked, T2', function () {
        beforeEach(async function () {
          await hre.ethers.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 2]);
          await link
            .connect(signers.communityStaker)
            .transferAndCall(staking.address, INITIAL_MIN_COMMUNITY_STAKE, proof);
        });

        describe('when reward rate is reduced to lowest, T3', function () {
          beforeEach(async function () {
            await hre.ethers.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 3]);
            await staking.connect(signers.owner).changeRewardRate(LOW_REWARD_RATE);
          });

          it('correctly updates reward duration', async function () {
            const earnedOperatorBaseRewards = getBaseReward({
              isTokenholder: false,
              secondsStaked: 2,
              stakeAmount: GENERAL_STAKE_AMOUNT,
            });
            const earnedCommunityStakerBaseRewards = getBaseReward({
              isTokenholder: true,
              secondsStaked: 1,
              stakeAmount: INITIAL_MIN_COMMUNITY_STAKE,
            });
            const earnedDelegatedRewards = getDelegationReward({
              inputs: [
                {
                  seconds: 1,
                  amount: INITIAL_MIN_COMMUNITY_STAKE,
                },
              ],
            });

            const remainingRewards = REWARD_AMOUNT.mul(10)
              .sub(earnedOperatorBaseRewards)
              .sub(earnedCommunityStakerBaseRewards)
              .sub(earnedDelegatedRewards);

            // Calculate expected remaining reward duration based off new rate
            const expectedRemainingRewardDuration = remainingRewards
              .div(LOW_REWARD_RATE)
              .div(MAX_POOL_SIZE.mul(MULTIPLIER).div(REWARD_PRECISION));

            const timestamp = INITIAL_START_TIMESTAMP + 3;
            const [, endTimestamp] = await staking.getRewardTimestamps();
            expect(endTimestamp).to.equal(BigNumber.from(timestamp).add(expectedRemainingRewardDuration));
          });

          it('correctly calculates operator 1 delegation rewards', async function () {
            const firstPeriodReward = getDelegationReward({
              inputs: [
                {
                  seconds: 1,
                  amount: INITIAL_MIN_COMMUNITY_STAKE,
                },
              ],
            });

            expect(await staking.connect(signers.operator).getDelegationReward(signers.operator.address)).to.equal(
              firstPeriodReward,
            );
          });

          describe('when Operator 2 joins, T4', function () {
            beforeEach(async function () {
              await hre.ethers.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 4]);
              await link.connect(signers.operatorTwo).transferAndCall(staking.address, GENERAL_STAKE_AMOUNT, []);
            });

            it('correctly calculates operator 1 base rewards', async function () {
              const firstPeriodReward = getBaseReward({
                isTokenholder: false,
                secondsStaked: 2,
                stakeAmount: GENERAL_STAKE_AMOUNT,
              });
              const secondPeriodReward = getBaseReward({
                isTokenholder: false,
                secondsStaked: 1,
                stakeAmount: GENERAL_STAKE_AMOUNT,
                rewardRate: LOW_REWARD_RATE,
              });

              expect(await staking.connect(signers.operator).getBaseReward(signers.operator.address)).to.equal(
                firstPeriodReward.add(secondPeriodReward),
              );
            });

            it('correctly calculates operator 1 delegation rewards', async function () {
              const firstPeriodReward = getDelegationReward({
                inputs: [
                  {
                    seconds: 1,
                    amount: INITIAL_MIN_COMMUNITY_STAKE,
                  },
                ],
              });
              const secondPeriodReward = getDelegationReward({
                inputs: [
                  {
                    seconds: 1,
                    amount: INITIAL_MIN_COMMUNITY_STAKE,
                    rewardRate: LOW_REWARD_RATE,
                  },
                ],
              });

              const actualDelegationReward = await staking
                .connect(signers.operator)
                .getDelegationReward(signers.operator.address);

              expect(actualDelegationReward).to.equal(firstPeriodReward.add(secondPeriodReward));
            });

            it('correctly calculates community staker 1 rewards', async function () {
              const firstPeriodReward = getBaseReward({
                isTokenholder: true,
                secondsStaked: 1,
                stakeAmount: INITIAL_MIN_COMMUNITY_STAKE,
              });
              const secondPeriodReward = getBaseReward({
                isTokenholder: true,
                secondsStaked: 1,
                stakeAmount: INITIAL_MIN_COMMUNITY_STAKE,
                rewardRate: LOW_REWARD_RATE,
              });

              expect(
                await staking.connect(signers.communityStaker).getBaseReward(signers.communityStaker.address),
              ).to.equal(firstPeriodReward.add(secondPeriodReward));
            });
          });
        });

        describe('when 10 seconds have passed', function () {
          beforeEach(async function () {
            await hre.ethers.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 12]);
          });

          describe('when rewards are increased', function () {
            it('correctly decreases the reward duration', async function () {
              const newRate = HIGH_REWARD_RATE;
              const tx = await staking.connect(signers.owner).changeRewardRate(newRate);

              // Calculate Remaining Rewards
              const earnedOperatorBaseRewards = getBaseReward({
                isTokenholder: false,
                secondsStaked: 11,
                stakeAmount: GENERAL_STAKE_AMOUNT,
              });
              const earnedCommunityStakerBaseRewards = getBaseReward({
                isTokenholder: true,
                secondsStaked: 10,
                stakeAmount: INITIAL_MIN_COMMUNITY_STAKE,
              });
              const earnedDelegatedRewards = getDelegationReward({
                inputs: [
                  {
                    seconds: 10,
                    amount: INITIAL_MIN_COMMUNITY_STAKE,
                  },
                ],
              });

              const remainingRewards = REWARD_AMOUNT.mul(10)
                .sub(earnedOperatorBaseRewards)
                .sub(earnedCommunityStakerBaseRewards)
                .sub(earnedDelegatedRewards);

              // Calculate expected remaining reward duration based off new rate
              const expectedRemainingRewardDuration = remainingRewards
                .div(newRate)
                .div(MAX_POOL_SIZE.mul(MULTIPLIER).div(REWARD_PRECISION));

              const timestamp = await getTxTimestamp(tx);
              const [, endTimestamp] = await staking.getRewardTimestamps();
              expect(endTimestamp).to.equal(BigNumber.from(timestamp).add(expectedRemainingRewardDuration));
            });

            describe('when new reward duration is too short', function () {
              it('reverts', async function () {
                const newRate = REWARD_RATE.mul(100);
                await expect(staking.connect(signers.owner).changeRewardRate(newRate)).to.be.revertedWith(
                  'RewardDurationTooShort()',
                );
              });
            });
          });

          describe('when rewards are decreased', function () {
            it('correctly increases the reward duration', async function () {
              const newRate = LOW_REWARD_RATE;
              const tx = await staking.connect(signers.owner).changeRewardRate(newRate);
              // Calculate Remaining Rewards
              const earnedOperatorBaseRewards = getBaseReward({
                isTokenholder: false,
                secondsStaked: 11,
                stakeAmount: GENERAL_STAKE_AMOUNT,
              });
              const earnedCommunityStakerBaseRewards = getBaseReward({
                isTokenholder: true,
                secondsStaked: 10,
                stakeAmount: INITIAL_MIN_COMMUNITY_STAKE,
              });
              const earnedDelegatedRewards = getDelegationReward({
                inputs: [
                  {
                    seconds: 10,
                    amount: INITIAL_MIN_COMMUNITY_STAKE,
                  },
                ],
              });

              const remainingRewards = REWARD_AMOUNT.mul(10)
                .sub(earnedOperatorBaseRewards)
                .sub(earnedCommunityStakerBaseRewards)
                .sub(earnedDelegatedRewards);

              // Calculate expected remaining reward duration based off new rate
              const expectedRemainingRewardDuration = remainingRewards
                .div(newRate)
                .div(MAX_POOL_SIZE.mul(MULTIPLIER).div(REWARD_PRECISION));

              const timestamp = await getTxTimestamp(tx);
              const [, endTimestamp] = await staking.getRewardTimestamps();
              expect(endTimestamp).to.equal(BigNumber.from(timestamp).add(expectedRemainingRewardDuration));
            });
          });
        });
      });

      describe('when 10 seconds have passed', function () {
        beforeEach(async function () {
          await hre.ethers.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 10]);
          await hre.ethers.provider.send('evm_mine', []);
        });

        describe('when rewards are increased', function () {
          it('correctly decreases the reward duration', async function () {
            const newRate = HIGH_REWARD_RATE;
            await hre.ethers.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 11]);
            const tx = await staking.connect(signers.owner).changeRewardRate(newRate);

            // Calculate Remaining Rewards
            const earnedBaseRewards = getBaseReward({
              isTokenholder: false,
              secondsStaked: 10,
              stakeAmount: GENERAL_STAKE_AMOUNT,
            });
            const earnedDelegatedRewards = 0;
            const remainingRewards = REWARD_AMOUNT.mul(10).sub(earnedBaseRewards).sub(earnedDelegatedRewards);

            // Calculate expected remaining reward duration based off new rate
            const expectedRemainingRewardDuration = remainingRewards
              .div(newRate)
              .div(MAX_POOL_SIZE.mul(MULTIPLIER).div(REWARD_PRECISION));

            const timestamp = await getTxTimestamp(tx);
            const [, endTimestamp] = await staking.getRewardTimestamps();
            expect(endTimestamp).to.equal(BigNumber.from(timestamp).add(expectedRemainingRewardDuration));
          });

          describe('when new reward duration is too short', function () {
            it('reverts', async function () {
              const newRate = REWARD_RATE.mul(100);
              await expect(staking.connect(signers.owner).changeRewardRate(newRate)).to.be.revertedWith(
                'RewardDurationTooShort()',
              );
            });
          });
        });

        describe('when rewards are decreased', function () {
          it('correctly increases the reward duration', async function () {
            const newRate = LOW_REWARD_RATE;
            const tx = await staking.connect(signers.owner).changeRewardRate(newRate);

            // Calculate Remaining Rewards
            const earnedBaseRewards = getBaseReward({
              isTokenholder: false,
              secondsStaked: 10,
              stakeAmount: GENERAL_STAKE_AMOUNT,
            });
            const earnedDelegatedRewards = 0;
            const remainingRewards = REWARD_AMOUNT.mul(10).sub(earnedBaseRewards).sub(earnedDelegatedRewards);

            // Calculate expected remaining reward duration based off new rate
            const expectedRemainingRewardDuration = remainingRewards
              .div(newRate)
              .div(MAX_POOL_SIZE.mul(MULTIPLIER).div(REWARD_PRECISION));

            const timestamp = await getTxTimestamp(tx);
            const [, endTimestamp] = await staking.getRewardTimestamps();
            expect(endTimestamp).to.equal(BigNumber.from(timestamp).add(expectedRemainingRewardDuration));
          });
        });
      });
    });

    describe('when reward is expired', function () {
      beforeEach(async function () {
        const [_, endTimestamp] = await staking.connect(signers.owner).getRewardTimestamps();
        await hre.ethers.provider.send('evm_setNextBlockTimestamp', [endTimestamp.toNumber() + 1]);
        await hre.ethers.provider.send('evm_mine', []);
      });

      it('reverts', async function () {
        expect(await staking.isActive()).to.equal(false); // pool has expired
        const newRate = LOW_REWARD_RATE;
        await expect(staking.connect(signers.owner).changeRewardRate(newRate)).to.be.revertedWith(
          'InvalidPoolStatus(false, true)',
        );
      });
    });

    describe('when staking is concluded', function () {
      beforeEach(async function () {
        await staking.connect(signers.owner).conclude();
      });

      it('reverts', async function () {
        expect(await staking.isActive()).to.equal(false); // pool has concluded
        const newRate = LOW_REWARD_RATE;
        await expect(staking.connect(signers.owner).changeRewardRate(newRate)).to.be.revertedWith(
          'InvalidPoolStatus(false, true)',
        );
      });
    });
  });

  describe('#proposeMigrationTarget', function () {
    describe('when supplied a contract address', function () {
      describe('when the migration target does not implement EIP 165', function () {
        it('reverts', async function () {
          await expect(staking.connect(signers.owner).proposeMigrationTarget(link.address)).to.be.revertedWith(
            `Transaction reverted without a reason string`,
          );
        });
      });

      describe('when the migration target is a LinkTokenReceiver', function () {
        it('emits an event', async function () {
          await expect(staking.connect(signers.owner).proposeMigrationTarget(stakingV1.address))
            .to.emit(staking, 'MigrationTargetProposed')
            .withArgs(stakingV1.address);
        });

        it('renounces previous migration target', async function () {
          await staking.connect(signers.owner).proposeMigrationTarget(stakingV1.address);

          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + SEVEN_DAYS + 100]);
          await staking.connect(signers.owner).acceptMigrationTarget();

          expect(await staking.getMigrationTarget()).to.equal(stakingV1.address);

          await staking.connect(signers.owner).proposeMigrationTarget(stakingV2.address);
          expect(await staking.getMigrationTarget()).to.equal(ethers.constants.AddressZero);
        });
      });

      describe('when the migration target is not a LinkTokenReceiver', function () {
        beforeEach(async function () {
          await invalidLinkTokenReceiver.mock.supportsInterface.returns(false);
        });

        it('reverts', async function () {
          await expect(
            staking.connect(signers.owner).proposeMigrationTarget(invalidLinkTokenReceiver.address),
          ).to.be.revertedWith('InvalidMigrationTarget()');
        });
      });
    });

    describe('when supplied a non-contract address', function () {
      it('reverts', async function () {
        await expect(staking.connect(signers.owner).proposeMigrationTarget(DUMMY_ADDRESS)).to.revertedWith(
          `InvalidMigrationTarget()`,
        );
      });
    });

    describe('when supplied a zero address', function () {
      it('reverts', async function () {
        await expect(
          staking.connect(signers.owner).proposeMigrationTarget(ethers.constants.AddressZero),
        ).to.be.revertedWith(`InvalidMigrationTarget()`);
      });
    });

    describe('when supplied the staking contract address', function () {
      it('reverts', async function () {
        await expect(staking.connect(signers.owner).proposeMigrationTarget(staking.address)).to.be.revertedWith(
          `InvalidMigrationTarget()`,
        );
      });
    });
  });

  describe('#acceptMigrationTarget', function () {
    describe('when no proposed migration target is set', function () {
      it('reverts', async function () {
        await expect(staking.connect(signers.owner).acceptMigrationTarget()).to.be.revertedWith(
          `InvalidMigrationTarget()`,
        );
      });
    });

    describe('when a proposed migration target is set', function () {
      beforeEach(async function () {
        await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP]);
        await staking.connect(signers.owner).proposeMigrationTarget(stakingV1.address);
      });

      describe('when re-proposing the same proposed migration target', function () {
        it('reverts', async function () {
          await expect(staking.connect(signers.owner).proposeMigrationTarget(stakingV1.address)).to.be.revertedWith(
            `InvalidMigrationTarget()`,
          );
        });
      });

      describe('when re-proposing a different migration target', function () {
        it('emits an event', async function () {
          const anotherMigrationTarget = await new MockMigrationTarget__factory(signers.owner).deploy();
          await expect(staking.connect(signers.owner).proposeMigrationTarget(anotherMigrationTarget.address))
            .to.emit(staking, 'MigrationTargetProposed')
            .withArgs(anotherMigrationTarget.address);
        });
      });

      describe('when 7 day waiting period is not met', function () {
        it('reverts', async function () {
          await expect(staking.connect(signers.owner).acceptMigrationTarget()).to.revertedWith(`AccessForbidden()`);
        });
      });

      describe('when 7 day waiting period is met', function () {
        beforeEach(async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + SEVEN_DAYS + 100]);
          await hre.network.provider.send('evm_mine', []);
        });

        it('sets migration target', async function () {
          await staking.connect(signers.owner).acceptMigrationTarget();
          const newMigrationTarget = await staking.getMigrationTarget();

          expect(newMigrationTarget).to.equal(stakingV1.address);
        });

        it('emits an event', async function () {
          await expect(staking.connect(signers.owner).acceptMigrationTarget())
            .to.emit(staking, 'MigrationTargetAccepted')
            .withArgs(stakingV1.address);
        });

        describe('when migration target is set', function () {
          beforeEach(async function () {
            await staking.connect(signers.owner).acceptMigrationTarget();
          });

          it('reverts', async function () {
            await expect(staking.connect(signers.owner).proposeMigrationTarget(stakingV1.address)).to.be.revertedWith(
              `InvalidMigrationTarget()`,
            );
          });
        });
      });
    });
  });

  describe('#pause', function () {
    it('pauses the pool', async function () {
      await staking.connect(signers.owner).emergencyPause();
      const isPaused = await staking.isPaused();
      expect(isPaused).to.equal(true);
    });
  });

  describe('#unpause', function () {
    beforeEach(async function () {
      await staking.connect(signers.owner).emergencyPause();
    });

    it('unpauses the pool', async function () {
      await staking.connect(signers.owner).emergencyUnpause();
      const isPaused = await staking.isPaused();
      expect(isPaused).to.equal(false);
    });
  });
});
