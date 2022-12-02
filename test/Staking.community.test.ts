import { expect } from 'chai';
import { Signers } from '../types';
import { LinkToken, Staking } from '../typechain';
import hre, { ethers } from 'hardhat';
import {
  INITIAL_MAX_COMMUNITY_STAKE,
  INITIAL_MIN_COMMUNITY_STAKE,
  REWARD_AMOUNT,
  INITIAL_START_TIMESTAMP,
  setupContracts,
  INITIAL_MAX_POOL_SIZE,
  INITIAL_MAX_OPERATOR_STAKE,
  GENERAL_STAKE_AMOUNT,
  REWARD_RATE,
  REWARD_PRECISION,
} from './utils/setup';
import { shouldRespectStakingPoolRules } from './Staking.shared.behaviour';
import { getBaseReward } from './utils/rewards';
import MerkleTree from 'merkletreejs';
import { getEncodedMerkleProof } from './utils/merkleTree';

describe('Staking - community staker', function () {
  let signers: Signers;
  let staking: Staking;
  let link: LinkToken;
  let merkleTree: MerkleTree;
  let proof: string;

  beforeEach(async function () {
    const config = await setupContracts();
    signers = config.signers;
    staking = config.staking;
    link = config.link;
    merkleTree = config.merkleTree;

    await staking.connect(signers.owner).addOperators(signers.defaultOperators);
    proof = getEncodedMerkleProof(merkleTree, signers.communityStaker.address);
  });

  shouldRespectStakingPoolRules(
    () => ({ staking, link }),
    () => signers.communityStaker,
    () => merkleTree,
  );

  describe('#getStake', function () {
    it('should return the principal amount', async function () {
      const stake = await staking.getStake(signers.communityStaker.address);
      expect(stake).to.equal('0');
    });
  });

  describe('#getBaseReward', function () {
    describe('when no principal is staked', function () {
      it('returns no rewards', async function () {
        const reward = await staking.getBaseReward(signers.communityStaker.address);
        expect(reward).to.equal('0');
      });
    });

    describe('when staking the minimum stake amount', function () {
      beforeEach(async function () {
        await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
        await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP]);
        await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);

        await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 10]);
        await link
          .connect(signers.communityStaker)
          .transferAndCall(
            staking.address,
            INITIAL_MIN_COMMUNITY_STAKE,
            getEncodedMerkleProof(merkleTree, signers.communityStaker.address),
          );
      });

      it('returns no rewards just after staking', async function () {
        const reward = await staking.getBaseReward(signers.communityStaker.address);
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
            const actualReward = await staking.getBaseReward(signers.communityStaker.address);

            expect(actualReward).to.equal(
              getBaseReward({ stakeAmount: INITIAL_MIN_COMMUNITY_STAKE, secondsStaked: 1, isTokenholder: true }),
            );
          });
        });
      });

      describe('when 1 second has passed', async function () {
        beforeEach(async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 11]);
          await hre.network.provider.send('evm_mine');
        });

        it('returns 1 second worth of rewards after 1 second has passed', async function () {
          const actualReward = await staking.getBaseReward(signers.communityStaker.address);

          expect(actualReward).to.equal(
            getBaseReward({ stakeAmount: INITIAL_MIN_COMMUNITY_STAKE, secondsStaked: 1, isTokenholder: true }),
          );
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
            const delegationRate = await staking.getDelegationRateDenominator();
            const firstRoundExpectedReward = INITIAL_MIN_COMMUNITY_STAKE.div(REWARD_PRECISION).mul(REWARD_RATE).mul(10);
            const firstRoundNonDelegatedReward = firstRoundExpectedReward.sub(
              firstRoundExpectedReward.div(delegationRate),
            );
            const secondRoundExpectedReward = INITIAL_MIN_COMMUNITY_STAKE.div(REWARD_PRECISION).mul(newRate).mul(10);
            const secondRoundNonDelegatedReward = secondRoundExpectedReward.sub(
              secondRoundExpectedReward.div(delegationRate),
            );
            const reward = await staking.getBaseReward(signers.communityStaker.address);
            expect(reward).to.equal(firstRoundNonDelegatedReward.add(secondRoundNonDelegatedReward));
          });
        });
      });

      describe('when staking the minimum stake amount again after 10 seconds', function () {
        beforeEach(async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 20]);
          await link
            .connect(signers.communityStaker)
            .transferAndCall(
              staking.address,
              INITIAL_MIN_COMMUNITY_STAKE,
              getEncodedMerkleProof(merkleTree, signers.communityStaker.address),
            );
        });

        it('returns 10 seconds worth of rewards for initial stake', async function () {
          const actualReward = await staking.getBaseReward(signers.communityStaker.address);

          expect(actualReward).to.equal(
            getBaseReward({ stakeAmount: INITIAL_MIN_COMMUNITY_STAKE, secondsStaked: 10, isTokenholder: true }),
          );
        });

        describe('when 20 seconds have passed after the initial stake', function () {
          beforeEach(async function () {
            await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 30]);
            await hre.network.provider.send('evm_mine');
          });

          it('returns correct rewards', async function () {
            const reward = await staking.getBaseReward(signers.communityStaker.address);

            const FIRST_STAKE_REWARD = getBaseReward({
              stakeAmount: INITIAL_MIN_COMMUNITY_STAKE,
              secondsStaked: 20,
              isTokenholder: true,
            });
            const SECOND_STAKE_REWARD = getBaseReward({
              stakeAmount: INITIAL_MIN_COMMUNITY_STAKE,
              secondsStaked: 10,
              isTokenholder: true,
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
          await link
            .connect(signers.communityStaker)
            .transferAndCall(
              staking.address,
              INITIAL_MIN_COMMUNITY_STAKE,
              getEncodedMerkleProof(merkleTree, signers.communityStaker.address),
            );

          const stake = await staking.getStake(signers.communityStaker.address);
          expect(stake).to.equal(INITIAL_MIN_COMMUNITY_STAKE);
        });

        it('should emit an event', async function () {
          await expect(
            link.connect(signers.communityStaker).transferAndCall(staking.address, INITIAL_MIN_COMMUNITY_STAKE, proof),
          )
            .to.emit(staking, 'Staked')
            .withArgs(signers.communityStaker.address, INITIAL_MIN_COMMUNITY_STAKE, INITIAL_MIN_COMMUNITY_STAKE);

          await expect(
            link.connect(signers.communityStaker).transferAndCall(staking.address, INITIAL_MIN_COMMUNITY_STAKE, proof),
          )
            .to.emit(staking, 'Staked')
            .withArgs(signers.communityStaker.address, INITIAL_MIN_COMMUNITY_STAKE, INITIAL_MIN_COMMUNITY_STAKE.mul(2));
        });

        it('the staked amount in LINK tokens is added to the staking contract', async function () {
          const linkBalanceBefore = await link.balanceOf(staking.address);
          await link
            .connect(signers.communityStaker)
            .transferAndCall(
              staking.address,
              INITIAL_MIN_COMMUNITY_STAKE,
              getEncodedMerkleProof(merkleTree, signers.communityStaker.address),
            );

          const linkBalanceAfter = await link.balanceOf(staking.address);
          expect(linkBalanceAfter.sub(linkBalanceBefore)).to.equal(INITIAL_MIN_COMMUNITY_STAKE);
        });

        it('additional staked amounts are added to the principal balance', async function () {
          await link
            .connect(signers.communityStaker)
            .transferAndCall(
              staking.address,
              INITIAL_MIN_COMMUNITY_STAKE,
              getEncodedMerkleProof(merkleTree, signers.communityStaker.address),
            );
          await link
            .connect(signers.communityStaker)
            .transferAndCall(
              staking.address,
              INITIAL_MIN_COMMUNITY_STAKE,
              getEncodedMerkleProof(merkleTree, signers.communityStaker.address),
            );
          const stake = await staking.getStake(signers.communityStaker.address);
          expect(stake).to.equal(INITIAL_MIN_COMMUNITY_STAKE.mul(2));
        });

        it('reverts when called from a non-LINK address', async function () {
          await expect(
            staking
              .connect(signers.communityStaker)
              .onTokenTransfer(signers.communityStaker.address, INITIAL_MIN_COMMUNITY_STAKE, proof),
          ).to.be.revertedWith('SenderNotLinkToken()');
        });

        it('delegates reward amount specified bythe delegation rate', async function () {
          await link
            .connect(signers.communityStaker)
            .transferAndCall(
              staking.address,
              INITIAL_MIN_COMMUNITY_STAKE,
              getEncodedMerkleProof(merkleTree, signers.communityStaker.address),
            );

          const [delegationRate, totalDelegatedAmount] = await Promise.all([
            staking.getDelegationRateDenominator(),
            staking.getTotalDelegatedAmount(),
          ]);
          const expectedDelegatedAmount = INITIAL_MIN_COMMUNITY_STAKE.div(delegationRate);
          expect(totalDelegatedAmount).to.equal(expectedDelegatedAmount);
        });
      });

      describe('when called with an insufficient stake amount', function () {
        it('reverts', async function () {
          const proof = getEncodedMerkleProof(merkleTree, signers.communityStaker.address);
          await expect(
            link
              .connect(signers.communityStaker)
              .transferAndCall(staking.address, INITIAL_MIN_COMMUNITY_STAKE.sub(REWARD_PRECISION), proof),
          ).to.be.revertedWith(`InsufficientStakeAmount(${INITIAL_MIN_COMMUNITY_STAKE})`);
        });

        it('reverts', async function () {
          const proof = getEncodedMerkleProof(merkleTree, signers.communityStaker.address);
          await expect(
            link.connect(signers.communityStaker).transferAndCall(staking.address, REWARD_PRECISION.sub(1), proof),
          ).to.be.revertedWith(`InsufficientStakeAmount(${REWARD_PRECISION})`);
        });
      });

      describe('when called with an excessive stake amount', function () {
        it('reverts', async function () {
          await expect(
            link
              .connect(signers.communityStaker)
              .transferAndCall(staking.address, INITIAL_MAX_COMMUNITY_STAKE.add(REWARD_PRECISION), proof),
          ).to.be.revertedWith(`ExcessiveStakeAmount(${INITIAL_MAX_COMMUNITY_STAKE})`);
        });
      });

      describe('when called with a stake amount that goes over remaining pool space', function () {
        const customMaxCommunityStake = ethers.utils.parseUnits('250000', 18);
        beforeEach(async function () {
          await staking
            .connect(signers.owner)
            .setPoolConfig(INITIAL_MAX_POOL_SIZE, customMaxCommunityStake, INITIAL_MAX_OPERATOR_STAKE.mul(16));
        });

        it('reverts', async function () {
          const expectedRemainingSpace = ethers.utils.parseUnits('200000', 18);
          await expect(
            link.connect(signers.communityStaker).transferAndCall(staking.address, customMaxCommunityStake, proof),
          ).to.be.revertedWith(`ExcessiveStakeAmount(${expectedRemainingSpace})`);
        });
      });

      describe('when staking an amount at risk of rounding loss', function () {
        const stakeAmount = ethers.utils.parseUnits('100.999999', 18);
        beforeEach(async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 10]);
          await link.connect(signers.communityStaker).transferAndCall(staking.address, stakeAmount, proof);
        });

        describe('when 1 second has passed', async function () {
          beforeEach(async function () {
            await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 11]);
            await hre.network.provider.send('evm_mine');
          });

          it('returns 1 second worth of reward with 6 decimal precision', async function () {
            const rewardAfter1Second = await staking.getBaseReward(signers.communityStaker.address);
            const expectedReward = getBaseReward({
              stakeAmount: stakeAmount,
              secondsStaked: 1,
              isTokenholder: true,
            });
            expect(rewardAfter1Second).to.equal(expectedReward);
          });
        });
      });

      describe('when pool is near capacity', function () {
        const customMaxCommunityStake = ethers.utils.parseUnits('240000', 18);
        beforeEach(async function () {
          await staking
            .connect(signers.owner)
            .setPoolConfig(INITIAL_MAX_POOL_SIZE, customMaxCommunityStake, INITIAL_MAX_OPERATOR_STAKE.mul(16));
          await link
            .connect(signers.communityStaker)
            .transferAndCall(staking.address, customMaxCommunityStake.div(3), proof);
        });

        it('allows staking when near but not over capacity', async function () {
          await link
            .connect(signers.communityStaker)
            .transferAndCall(staking.address, customMaxCommunityStake.div(3), proof);

          const stake = await staking.getStake(signers.communityStaker.address);
          expect(stake).to.equal(customMaxCommunityStake.div(3).mul(2));
        });

        it('reverts when new amount takes it over capacity', async function () {
          const expectedRemainingCapacity = ethers.utils.parseUnits('40000', 18);
          await link
            .connect(signers.communityStaker)
            .transferAndCall(staking.address, customMaxCommunityStake.div(3), proof);

          await expect(
            link
              .connect(signers.communityStaker)
              .transferAndCall(staking.address, customMaxCommunityStake.div(3), proof),
          ).to.be.revertedWith(`ExcessiveStakeAmount(${expectedRemainingCapacity})`);
        });
      });

      describe('when pool is full', function () {
        const customMaxCommunityStake = ethers.utils.parseUnits('250000', 18);
        const communityStakerCapacity = ethers.utils.parseUnits('200000', 18);
        beforeEach(async function () {
          await staking
            .connect(signers.owner)
            .setPoolConfig(INITIAL_MAX_POOL_SIZE, customMaxCommunityStake, INITIAL_MAX_OPERATOR_STAKE.mul(16));

          await link.connect(signers.communityStaker).transferAndCall(staking.address, communityStakerCapacity, proof);
        });

        it('reverts', async function () {
          await expect(
            link
              .connect(signers.communityStaker)
              .transferAndCall(staking.address, customMaxCommunityStake.sub(communityStakerCapacity), proof),
          ).to.be.revertedWith(`ExcessiveStakeAmount(0)`);
        });
      });
    });

    describe('when pool is closed', function () {
      beforeEach(async function () {
        await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
        await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);
        await staking.connect(signers.owner).conclude();
        expect(await staking.isActive()).to.equal(false);
      });

      it('reverts', async function () {
        await expect(
          link.connect(signers.communityStaker).transferAndCall(staking.address, GENERAL_STAKE_AMOUNT, proof),
        ).to.be.revertedWith('InvalidPoolStatus(false, true)');
      });
    });
  });

  describe('#unstake', function () {
    beforeEach(async function () {
      await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
      await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP]);
      await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);
    });

    describe('when stake exists', function () {
      beforeEach(async function () {
        await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 1]);
        await link.connect(signers.communityStaker).transferAndCall(staking.address, GENERAL_STAKE_AMOUNT, proof);
      });

      describe('when reward rate is changed', function () {
        const newRate = REWARD_RATE.div(2);

        beforeEach(async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 3]);
          await staking.connect(signers.owner).changeRewardRate(newRate);
        });

        describe('when pool is closed', function () {
          beforeEach(async function () {
            await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 4]);
            await staking.connect(signers.owner).conclude();
          });

          it('principal and rewards are transferred from the staking contract', async function () {
            const stakingContractLINKBalanceBefore = await link.balanceOf(staking.address);
            const stake = await staking.getStake(signers.communityStaker.address);
            await link.connect(signers.owner).transfer(staking.address, ethers.utils.parseUnits('1', '18'));
            const baseReward = await staking.getBaseReward(signers.communityStaker.address);

            await staking.connect(signers.communityStaker).unstake();

            const stakingContractLINKBalanceAfter = await link.balanceOf(staking.address);
            expect(
              stakingContractLINKBalanceBefore
                .sub(stakingContractLINKBalanceAfter)
                .add(ethers.utils.parseUnits('1', '18')),
            ).to.equal(stake.add(baseReward));
          });

          it('transfers the principal and rewards to the staker', async function () {
            const stakerLINKBalanceBefore = await link.balanceOf(signers.communityStaker.address);
            const stake = await staking.getStake(signers.communityStaker.address);
            const baseReward = await staking.getBaseReward(signers.communityStaker.address);

            await link.connect(signers.owner).transfer(staking.address, ethers.utils.parseUnits('1', '18'));
            await staking.connect(signers.communityStaker).unstake();

            const stakerLINKBalanceAfter = await link.balanceOf(signers.communityStaker.address);
            expect(stakerLINKBalanceAfter.sub(stakerLINKBalanceBefore)).to.equal(stake.add(baseReward));
          });
        });
      });

      describe('when pool is closed', function () {
        beforeEach(async function () {
          await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 2]);
          await staking.connect(signers.owner).conclude();
        });

        it('transfers the principal and rewards from the staking contract', async function () {
          const stakingContractLINKBalanceBefore = await link.balanceOf(staking.address);

          const stake = await staking.getStake(signers.communityStaker.address);
          const reward = await staking.getBaseReward(signers.communityStaker.address);
          await staking.connect(signers.communityStaker).unstake();

          const stakingContractLINKBalanceAfter = await link.balanceOf(staking.address);
          expect(stakingContractLINKBalanceBefore.sub(stakingContractLINKBalanceAfter)).to.equal(stake.add(reward));
        });

        it('transfers the principal and rewards to the staker', async function () {
          const stakerLINKBalanceBefore = await link.balanceOf(signers.communityStaker.address);

          const stake = await staking.getStake(signers.communityStaker.address);
          const reward = await staking.getBaseReward(signers.communityStaker.address);
          await staking.connect(signers.communityStaker).unstake();

          const stakerLINKBalanceAfter = await link.balanceOf(signers.communityStaker.address);
          expect(stakerLINKBalanceAfter.sub(stakerLINKBalanceBefore)).to.equal(stake.add(reward));
        });

        it('should emit an event', async function () {
          const reward = await staking.getBaseReward(signers.communityStaker.address);

          await expect(staking.connect(signers.communityStaker).unstake())
            .to.emit(staking, 'Unstaked')
            .withArgs(signers.communityStaker.address, GENERAL_STAKE_AMOUNT, reward, '0');
        });
      });
    });
  });

  describe('#getTotalDelegatedAmount', function () {
    describe('when no stakers staked', function () {
      it('returns 0', async function () {
        const totalDelegatedAmount = await staking.getTotalDelegatedAmount();
        expect(totalDelegatedAmount).to.equal('0');
      });
    });
  });
});
