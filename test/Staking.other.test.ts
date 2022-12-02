import hre from 'hardhat';
import { expect } from 'chai';
import { Signers } from '../types';
import { Staking } from '../typechain';
import {
  INITIAL_MAX_OPERATOR_STAKE,
  INITIAL_MAX_POOL_SIZE,
  INITIAL_MAX_COMMUNITY_STAKE,
  INITIAL_MIN_OPERATOR_STAKE,
  INITIAL_MIN_COMMUNITY_STAKE,
  REWARD_AMOUNT,
  setupContracts,
  INITIAL_START_TIMESTAMP,
  DUMMY_ADDRESS,
  REWARD_RATE,
} from './utils/setup';
import { TEST_MERKLE_ROOT } from './utils/mockdata';
import { LinkToken } from '../typechain';
import { getBaseReward } from './utils/rewards';
import { getEncodedMerkleProof } from './utils/merkleTree';

describe('Staking - Other', function () {
  let signers: Signers;
  let staking: Staking;
  let link: LinkToken;
  let proof: string;

  beforeEach(async function () {
    const config = await setupContracts();
    signers = config.signers;
    staking = config.staking;
    link = config.link;
    proof = getEncodedMerkleProof(config.merkleTree, signers.communityStaker.address);
  });

  describe('#getMaxPoolSize', async function () {
    it('pool size is returned', async function () {
      expect(await staking.connect(signers.other).getMaxPoolSize()).to.equal(INITIAL_MAX_POOL_SIZE);
    });
  });

  describe('#getCommunityStakerLimits', async function () {
    it('min and max amounts are returned', async function () {
      const [minCommunityStakeAmount, maxCommunityStakeAmount] = await staking
        .connect(signers.other)
        .getCommunityStakerLimits();
      expect(minCommunityStakeAmount).to.equal(INITIAL_MIN_COMMUNITY_STAKE);
      expect(maxCommunityStakeAmount).to.equal(INITIAL_MAX_COMMUNITY_STAKE);
    });
  });

  describe('#getOperatorLimits', async function () {
    it('min and max amounts are returned', async function () {
      const [minOperatorStakeAmount, maxOperatorStakeAMount] = await staking.connect(signers.other).getOperatorLimits();
      expect(minOperatorStakeAmount).to.equal(INITIAL_MIN_OPERATOR_STAKE);
      expect(maxOperatorStakeAMount).to.equal(INITIAL_MAX_OPERATOR_STAKE);
    });
  });

  describe('#getEarnedBaseRewards', async function () {
    beforeEach(async function () {
      await staking.connect(signers.owner).addOperators(signers.defaultOperators);
      await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
      await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP]);
      await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);
      await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 1]);
      await link.connect(signers.communityStaker).transferAndCall(staking.address, INITIAL_MIN_COMMUNITY_STAKE, proof);

      await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 2]);
      await link.connect(signers.communityStaker).transferAndCall(staking.address, INITIAL_MIN_COMMUNITY_STAKE, proof);

      await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 3]);
      await hre.network.provider.send('evm_mine');
    });

    describe('when max Operator stake amount is changed', function () {
      // Technically, any on-chain action changes earned rewards because of the newly mined block and
      // 1 additional second of staking. However, practically we are testing that the earned amounts
      // are unaffected by the action.
      it('does not change the earned base reward', async function () {
        const earnedBaseRewardsBefore = await staking.connect(signers.other).getEarnedBaseRewards();

        const newMaxOperatorStake = INITIAL_MAX_OPERATOR_STAKE.mul(2);
        await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 4]);
        await staking
          .connect(signers.owner)
          .setPoolConfig(INITIAL_MAX_POOL_SIZE, INITIAL_MAX_COMMUNITY_STAKE, newMaxOperatorStake);
        const earnedBaseRewardsAfter = await staking.connect(signers.other).getEarnedBaseRewards();

        const FIRST_STAKE_REWARD = getBaseReward({
          stakeAmount: INITIAL_MIN_COMMUNITY_STAKE,
          isTokenholder: true,
          secondsStaked: 1,
        });
        const SECOND_STAKE_REWARD = getBaseReward({
          stakeAmount: INITIAL_MIN_COMMUNITY_STAKE,
          isTokenholder: true,
          secondsStaked: 1,
        });
        expect(earnedBaseRewardsAfter).to.equal(
          earnedBaseRewardsBefore.add(FIRST_STAKE_REWARD).add(SECOND_STAKE_REWARD),
        );
      });
    });

    describe('when max pool size is changed', function () {
      // Technically, any on-chain action changes earned rewards because of the newly mined block and
      // 1 additional second of staking. However, practically we are testing that the earned amounts
      // are unaffected by the action.
      it('does not change the earned base reward', async function () {
        const earnedBaseRewardsBefore = await staking.connect(signers.other).getEarnedBaseRewards();

        await hre.network.provider.send('evm_setNextBlockTimestamp', [INITIAL_START_TIMESTAMP + 4]);
        await staking
          .connect(signers.owner)
          .setPoolConfig(INITIAL_MAX_POOL_SIZE.mul(2), INITIAL_MAX_COMMUNITY_STAKE, INITIAL_MAX_OPERATOR_STAKE);
        const earnedBaseRewardsAfter = await staking.connect(signers.other).getEarnedBaseRewards();

        const FIRST_STAKE_REWARD = getBaseReward({
          stakeAmount: INITIAL_MIN_COMMUNITY_STAKE,
          isTokenholder: true,
          secondsStaked: 1,
        });
        const SECOND_STAKE_REWARD = getBaseReward({
          stakeAmount: INITIAL_MIN_COMMUNITY_STAKE,
          isTokenholder: true,
          secondsStaked: 1,
        });
        expect(earnedBaseRewardsAfter).to.equal(
          earnedBaseRewardsBefore.add(FIRST_STAKE_REWARD).add(SECOND_STAKE_REWARD),
        );
      });
    });

    it('returns earned base rewards', async function () {
      const earnedBaseRewards = await staking.connect(signers.other).getEarnedBaseRewards();
      const FIRST_STAKE_REWARD = getBaseReward({
        stakeAmount: INITIAL_MIN_COMMUNITY_STAKE,
        isTokenholder: true,
        secondsStaked: 2,
      });
      const SECOND_STAKE_REWARD = getBaseReward({
        stakeAmount: INITIAL_MIN_COMMUNITY_STAKE,
        isTokenholder: true,
        secondsStaked: 1,
      });
      expect(earnedBaseRewards).to.equal(FIRST_STAKE_REWARD.add(SECOND_STAKE_REWARD));
    });
  });

  describe('#isOperator', function () {
    it('returns false', async function () {
      expect(await staking.isOperator(signers.other.address)).to.equal(false);
    });
  });

  describe('#setMerkleRoot', function () {
    it('reverts', async function () {
      await expect(staking.connect(signers.other.address).setMerkleRoot(TEST_MERKLE_ROOT)).to.revertedWith(
        'Only callable by owner',
      );
    });
  });

  describe('#addOperators', function () {
    it('reverts', async function () {
      await expect(staking.connect(signers.other.address).addOperators([signers.operator.address])).to.revertedWith(
        'Only callable by owner',
      );
    });
  });

  describe('#removeOperators', function () {
    it('reverts', async function () {
      await expect(staking.connect(signers.other.address).removeOperators([signers.operator.address])).to.revertedWith(
        'Only callable by owner',
      );
    });
  });

  describe('#setPoolConfig', function () {
    it('reverts', async function () {
      await expect(
        staking
          .connect(signers.other)
          .setPoolConfig(
            INITIAL_MAX_POOL_SIZE.mul(2),
            INITIAL_MAX_COMMUNITY_STAKE.mul(2),
            INITIAL_MAX_OPERATOR_STAKE.mul(2),
          ),
      ).to.revertedWith('Only callable by owner');
    });
  });

  describe('#changeRewardRate', function () {
    it('reverts', async function () {
      await expect(staking.connect(signers.other).changeRewardRate(REWARD_RATE.div(2))).to.be.revertedWith(
        'Only callable by owner',
      );
    });
  });

  describe('#addReward', function () {
    it('reverts', async function () {
      await expect(staking.connect(signers.other).addReward(REWARD_AMOUNT)).to.be.revertedWith(
        'Only callable by owner',
      );
    });
  });

  describe('#conclude', function () {
    it('reverts', async function () {
      await expect(staking.connect(signers.other.address).conclude()).to.revertedWith('AccessForbidden()');
    });
  });

  describe('#withdrawUnusedReward', function () {
    it('reverts', async function () {
      await expect(staking.connect(signers.other.address).withdrawUnusedReward()).to.revertedWith('AccessForbidden()');
    });
  });

  describe('#start', function () {
    it('reverts', async function () {
      await link.connect(signers.other).approve(staking.address, REWARD_AMOUNT);

      await expect(staking.connect(signers.other.address).start(REWARD_AMOUNT, REWARD_RATE)).to.revertedWith(
        'AccessForbidden()',
      );
    });
  });

  describe('#setFeedOperators', function () {
    it('reverts', async function () {
      await expect(staking.connect(signers.other.address).setFeedOperators([signers.operator.address])).to.revertedWith(
        'AccessForbidden()',
      );
    });
  });

  describe('#proposeMigrationTarget', function () {
    it('reverts', async function () {
      await expect(staking.connect(signers.other.address).proposeMigrationTarget(DUMMY_ADDRESS)).to.revertedWith(
        'AccessForbidden()',
      );
    });
  });

  describe('#acceptMigrationTarget', function () {
    it('reverts', async function () {
      await expect(staking.connect(signers.other.address).acceptMigrationTarget()).to.revertedWith('AccessForbidden()');
    });
  });

  describe('#pause', function () {
    it('reverts', async function () {
      await expect(staking.connect(signers.other.address).emergencyPause()).to.revertedWith('AccessForbidden()');
    });
  });

  describe('#unpause', function () {
    it('reverts', async function () {
      await expect(staking.connect(signers.other.address).emergencyUnpause()).to.revertedWith('AccessForbidden()');
    });
  });
});
