import hre, { ethers } from 'hardhat';
import { expect } from 'chai';
import { getSigners } from './utils/signers';
import { Signers } from '../types';
import { LinkToken, MockMigrationTarget, MockMigrationTarget__factory, Staking } from '../typechain';
import {
  GENERAL_STAKE_AMOUNT,
  REWARD_AMOUNT,
  INITIAL_START_TIMESTAMP,
  SEVEN_DAYS,
  DUMMY_BYTES,
  REWARD_RATE,
  REWARD_PRECISION,
} from './utils/setup';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { getBaseReward } from './utils/rewards';
import MerkleTree from 'merkletreejs';
import { getEncodedMerkleProof } from './utils/merkleTree';

export function shouldRespectStakingPoolRules(
  getContracts: () => {
    link: LinkToken;
    staking: Staking;
  },
  getActor: () => SignerWithAddress,
  getMerkleTree: () => MerkleTree,
) {
  let link: LinkToken;
  let signers: Signers;
  let staking: Staking;
  let staker: SignerWithAddress;
  let merkleTree: MerkleTree;

  describe('shared staking pool rules', function () {
    before(async function () {
      signers = await getSigners();
    });

    beforeEach(async function () {
      const contracts = getContracts();
      staker = getActor();
      link = contracts.link;
      staking = contracts.staking;
      merkleTree = getMerkleTree();
    });

    describe('#stake', function () {
      describe('when pool is open', function () {
        beforeEach(async function () {
          await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP]);
          await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);
        });

        describe('when called with an amount that is not a multiple of REWARD_PRECISION', function () {
          it('returns the remainder to the user', async function () {
            const [stakerLINKBalanceBefore, isStakerOperator] = await Promise.all([
              link.balanceOf(staker.address),
              staking.isOperator(staker.address),
            ]);
            const proof = isStakerOperator ? [] : getEncodedMerkleProof(merkleTree, staker.address);

            await link.connect(staker).transferAndCall(staking.address, GENERAL_STAKE_AMOUNT.add(1), proof);

            const [stake, stakerLINKBalanceAfter] = await Promise.all([
              staking.getStake(staker.address),
              link.balanceOf(staker.address),
            ]);
            expect(stake).to.equal(GENERAL_STAKE_AMOUNT);
            expect(stakerLINKBalanceBefore.sub(GENERAL_STAKE_AMOUNT)).to.eq(stakerLINKBalanceAfter);
          });
        });

        describe('when staker has stake', function () {
          beforeEach(async function () {
            const isStakerOperator = await staking.isOperator(staker.address);
            const proof = isStakerOperator ? [] : getEncodedMerkleProof(merkleTree, staker.address);
            await link.connect(staker).transferAndCall(staking.address, GENERAL_STAKE_AMOUNT, proof);
          });

          describe('when staker stakes multiple times', function () {
            describe('when stake within min stake limits', function () {
              it('increases stake', async function () {
                const isStakerOperator = await staking.isOperator(staker.address);
                const proof = isStakerOperator ? [] : getEncodedMerkleProof(merkleTree, staker.address);
                const [minStakeAmount] = isStakerOperator
                  ? await staking.getOperatorLimits()
                  : await staking.getCommunityStakerLimits();

                const oldStake = await staking.getStake(staker.address);
                const lessThanMinimumStakeAmount = minStakeAmount.sub(REWARD_PRECISION);
                await link
                  .connect(staker)
                  .transferAndCall(staking.address, minStakeAmount.sub(REWARD_PRECISION), proof);

                const newStake = await staking.getStake(staker.address);
                expect(newStake.sub(oldStake)).to.equal(lessThanMinimumStakeAmount);
              });
            });

            describe('when stake exceeds max stake limits', function () {
              it('reverts', async function () {
                const isStakerOperator = await staking.isOperator(staker.address);
                const [, maxStakeAmount] = isStakerOperator
                  ? await staking.getOperatorLimits()
                  : await staking.getCommunityStakerLimits();

                const stake = await staking.getStake(staker.address);
                const proof = isStakerOperator ? [] : getEncodedMerkleProof(merkleTree, staker.address);
                await expect(
                  link.connect(staker).transferAndCall(staking.address, maxStakeAmount, proof),
                ).to.be.revertedWith(`ExcessiveStakeAmount(${maxStakeAmount.sub(stake)})`);
              });
            });
          });
        });
      });

      describe('when reward is expired', function () {
        beforeEach(async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP * 10]);
        });

        it('reverts', async function () {
          await expect(
            link.connect(staker).transferAndCall(staking.address, GENERAL_STAKE_AMOUNT, []),
          ).to.be.revertedWith('InvalidPoolStatus(false, true)');
        });
      });

      describe('when pool is paused', function () {
        beforeEach(async function () {
          await staking.connect(signers.owner).emergencyPause();
        });

        it('reverts', async function () {
          await expect(
            link.connect(staker).transferAndCall(staking.address, GENERAL_STAKE_AMOUNT, []),
          ).to.be.revertedWith('Pausable: paused');
        });
      });
    });

    describe('#unstake', function () {
      beforeEach(async function () {
        await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
        await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP]);
        await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);
      });

      describe('when staker has not staked', function () {
        describe('when pool is closed', function () {
          beforeEach(async function () {
            await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 2]);
            await staking.connect(signers.owner).conclude();
          });

          it('reverts', async function () {
            await expect(staking.connect(staker).unstake()).to.be.revertedWith(`StakeNotFound("${staker.address}")`);
          });
        });
      });

      describe('when staker has staked', function () {
        beforeEach(async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 1]);
          const isStakerOperator = await staking.isOperator(staker.address);
          const proof = isStakerOperator ? [] : getEncodedMerkleProof(merkleTree, staker.address);
          await link.connect(staker).transferAndCall(staking.address, GENERAL_STAKE_AMOUNT, proof);
        });

        describe('when pool is closed', function () {
          beforeEach(async function () {
            await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 3]);
            await staking.connect(signers.owner).conclude();
          });

          it('reduces total staked amount', async function () {
            const totalStakedBefore = await staking.getTotalStakedAmount();
            await staking.connect(staker).unstake();
            const totalStakedAfter = await staking.getTotalStakedAmount();
            expect(totalStakedBefore.sub(totalStakedAfter)).to.equal(GENERAL_STAKE_AMOUNT);
          });

          it('should set staked amount to 0', async function () {
            await staking.connect(staker).unstake();
            const stakeAfter = await staking.getStake(staker.address);
            expect(stakeAfter).to.equal('0');
          });

          describe('when staker tries to unstake multiple times', function () {
            beforeEach(async function () {
              await staking.connect(staker).unstake();
            });

            it('reverts', async function () {
              await expect(staking.connect(staker).unstake()).to.be.revertedWith(`StakeNotFound("${staker.address}")`);
            });
          });
        });

        describe('when pool is open', function () {
          describe('when reward has not expired', async function () {
            it('should revert', async function () {
              await expect(staking.connect(staker).unstake()).to.be.revertedWith('InvalidPoolStatus(true, false)');
            });
          });

          describe('when reward has expired', function () {
            beforeEach(async function () {
              const [, endTimestamp] = await staking.getRewardTimestamps();
              await hre.network.provider.send('evm_setNextBlockTimestamp', [endTimestamp.toNumber()]);
              await hre.network.provider.send('evm_mine');
            });

            it('principal and rewards are transferred from the staking contract', async function () {
              const stakingContractLINKBalanceBefore = await link.balanceOf(staking.address);

              const stake = await staking.getStake(staker.address);
              const baseReward = await staking.getBaseReward(staker.address);
              const delegationReward = await staking.getDelegationReward(staker.address);
              await staking.connect(staker).unstake();

              const stakingContractLINKBalanceAfter = await link.balanceOf(staking.address);
              expect(stakingContractLINKBalanceBefore.sub(stakingContractLINKBalanceAfter)).to.equal(
                stake.add(baseReward).add(delegationReward),
              );
            });

            it('principal and rewards are transferred to the staker', async function () {
              const stakerLINKBalanceBefore = await link.balanceOf(staker.address);

              const stake = await staking.getStake(staker.address);
              const baseReward = await staking.getBaseReward(staker.address);
              const delegationReward = await staking.getDelegationReward(staker.address);
              await staking.connect(staker).unstake();

              const stakerLINKBalanceAfter = await link.balanceOf(staker.address);
              expect(stakerLINKBalanceAfter.sub(stakerLINKBalanceBefore)).to.equal(
                stake.add(baseReward).add(delegationReward),
              );
            });

            it("sets the staker's stake to be 0", async function () {
              await staking.connect(staker).unstake();
              const remainingStake = await staking.getStake(staker.address);
              expect(remainingStake).to.equal(0);
            });

            it("causes the staker's rewards to go to 0", async function () {
              await staking.connect(staker).unstake();
              const baseRewardsAfter = await staking.getBaseReward(staker.address);
              const delegationRateRewardsAfter = await staking.getDelegationReward(staker.address);
              expect(baseRewardsAfter.add(delegationRateRewardsAfter)).to.equal(0);
            });

            it('should emit an event', async function () {
              const baseReward = await staking.getBaseReward(staker.address);
              const delegationReward = await staking.getDelegationReward(staker.address);

              await expect(staking.connect(staker).unstake())
                .to.emit(staking, 'Unstaked')
                .withArgs(staker.address, GENERAL_STAKE_AMOUNT, baseReward, delegationReward);
            });
          });
        });
      });
    });

    describe('#getEarnedBaseRewards', function () {
      beforeEach(async function () {
        await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
        await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP]);
        await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);

        expect(await staking.isActive()).to.equal(true);
      });

      describe('when staker has staked', function () {
        beforeEach(async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 1]);
          const isStakerOperator = await staking.isOperator(staker.address);
          const proof = isStakerOperator ? [] : getEncodedMerkleProof(merkleTree, staker.address);
          await link.connect(staker).transferAndCall(staking.address, GENERAL_STAKE_AMOUNT, proof);
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 2]);
          await hre.network.provider.send('evm_mine');
        });

        it('returns the correct earned rewards amount', async function () {
          const earnedRewards = await staking.getEarnedBaseRewards();
          const FIRST_STAKE_REWARD = getBaseReward({
            stakeAmount: GENERAL_STAKE_AMOUNT,
            isTokenholder: staker.address === signers.communityStaker.address,
            secondsStaked: 1,
          });

          expect(earnedRewards).to.equal(FIRST_STAKE_REWARD);
        });

        describe('when pool concludes', function () {
          beforeEach(async function () {
            await staking.connect(signers.owner).conclude();
          });

          it('stops accumulating', async function () {
            const earnedRewardsBefore = await staking.getEarnedBaseRewards();
            await hre.network.provider.send('evm_increaseTime', [1]);
            await hre.network.provider.send('evm_mine');
            const earnedRewardsAfter = await staking.getEarnedBaseRewards();
            expect(earnedRewardsAfter).to.equal(earnedRewardsBefore);
          });
        });
      });
    });

    describe('#getDelegationReward', function () {
      describe('when staker has no stake', function () {
        it('returns 0', async function () {
          const delegationReward = await staking.getDelegationReward(staker.address);
          expect(delegationReward).to.equal('0');
        });
      });
    });

    describe('#addReward', function () {
      it('reverts', async function () {
        await expect(staking.connect(staker).addReward(REWARD_AMOUNT)).to.be.revertedWith('Only callable by owner');
      });
    });

    describe('#migrate', function () {
      beforeEach(async function () {
        await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
        await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);

        expect(await staking.isActive()).to.equal(true);

        // Staker staked
        const isStakerOperator = await staking.isOperator(staker.address);
        const proof = isStakerOperator ? [] : getEncodedMerkleProof(merkleTree, staker.address);
        await link.connect(staker).transferAndCall(staking.address, GENERAL_STAKE_AMOUNT, proof);
      });

      describe('when pool is open', function () {
        it('reverts', async function () {
          await expect(staking.connect(staker).migrate('0x')).to.be.revertedWith(`InvalidPoolStatus(true, false)`);
        });
      });

      describe('when pool is closed', function () {
        beforeEach(async function () {
          await staking.connect(signers.owner).conclude();
        });

        describe('when no migration target is set', async function () {
          it('reverts', async function () {
            await expect(staking.connect(staker).migrate('0x')).to.be.revertedWith(`InvalidMigrationTarget`);
          });
        });

        describe('when a migration target is set', function () {
          let migrationTarget: MockMigrationTarget;

          beforeEach(async function () {
            migrationTarget = await new MockMigrationTarget__factory(signers.owner).deploy();
            await staking.connect(signers.owner).proposeMigrationTarget(migrationTarget.address);
            const { timestamp: latestBlockTimestamp } = await ethers.provider.getBlock('latest');
            await hre.network.provider.send('evm_setNextBlockTimestamp', [latestBlockTimestamp + SEVEN_DAYS + 100]);
            await hre.network.provider.send('evm_mine', []);
            await staking.connect(signers.owner).acceptMigrationTarget();
          });

          describe('when staker has no stake', function () {
            it('reverts', async function () {
              await expect(staking.connect(signers.other).withdrawRemovedStake()).to.be.revertedWith(
                `StakeNotFound("${signers.other.address}")`,
              );
            });
          });

          describe('when staker has stake', function () {
            it('migrates sent amount and data to migration target', async function () {
              const principal = await staking.getStake(staker.address);
              const baseReward = await staking.getBaseReward(staker.address);
              const delegationReward = await staking.getDelegationReward(staker.address);
              const amount = principal.add(baseReward).add(delegationReward);
              await staking.connect(staker).migrate(DUMMY_BYTES);

              const migratedAmount = await migrationTarget.migratedAmount(staker.address);
              const migratedData = await migrationTarget.migratedData(staker.address);
              expect(migratedAmount).to.equal(amount);
              expect(migratedData).to.equal(DUMMY_BYTES);
            });

            it('reduces total staked amount', async function () {
              const totalStakedBefore = await staking.getTotalStakedAmount();
              await staking.connect(staker).migrate(ethers.utils.defaultAbiCoder.encode(['address'], [staker.address]));
              const totalStakedAfter = await staking.getTotalStakedAmount();
              expect(totalStakedBefore.sub(totalStakedAfter)).to.equal(GENERAL_STAKE_AMOUNT);
            });

            it('should set staked amount to 0', async function () {
              await staking.connect(staker).migrate(ethers.utils.defaultAbiCoder.encode(['address'], [staker.address]));
              const stakeAfter = await staking.getStake(staker.address);
              expect(stakeAfter).to.equal('0');
            });

            it('principal and rewards are transferred from the staking contract', async function () {
              const stakingContractLINKBalanceBefore = await link.balanceOf(staking.address);

              const principal = await staking.getStake(staker.address);
              const baseReward = await staking.getBaseReward(staker.address);
              const delegationReward = await staking.getDelegationReward(staker.address);
              await staking.connect(staker).migrate(ethers.utils.defaultAbiCoder.encode(['address'], [staker.address]));

              const stakingContractLINKBalanceAfter = await link.balanceOf(staking.address);
              expect(stakingContractLINKBalanceBefore.sub(stakingContractLINKBalanceAfter)).to.equal(
                principal.add(baseReward).add(delegationReward),
              );
            });

            it('principal and rewards are transferred to the migration target', async function () {
              const stakerLINKBalanceBefore = await link.balanceOf(migrationTarget.address);

              const principal = await staking.getStake(staker.address);
              const baseReward = await staking.getBaseReward(staker.address);
              const delegationReward = await staking.getDelegationReward(staker.address);
              await staking.connect(staker).migrate(ethers.utils.defaultAbiCoder.encode(['address'], [staker.address]));

              const stakerLINKBalanceAfter = await link.balanceOf(migrationTarget.address);
              expect(stakerLINKBalanceAfter.sub(stakerLINKBalanceBefore)).to.equal(
                principal.add(baseReward).add(delegationReward),
              );
            });

            it('emits an event', async function () {
              const principal = await staking.getStake(staker.address);
              const baseReward = await staking.getBaseReward(staker.address);
              const delegationReward = await staking.getDelegationReward(staker.address);

              await expect(staking.connect(staker).migrate(DUMMY_BYTES))
                .to.emit(staking, 'Migrated')
                .withArgs(staker.address, principal, baseReward, delegationReward, DUMMY_BYTES);
            });

            describe('when staker tries to migrate multiple times', function () {
              beforeEach(async function () {
                await staking
                  .connect(staker)
                  .migrate(ethers.utils.defaultAbiCoder.encode(['address'], [staker.address]));
              });

              it('reverts', async function () {
                await expect(
                  staking.connect(staker).migrate(ethers.utils.defaultAbiCoder.encode(['address'], [staker.address])),
                ).to.be.revertedWith(`StakeNotFound("${staker.address}")`);
              });
            });
          });
        });
      });
    });
  });
}
