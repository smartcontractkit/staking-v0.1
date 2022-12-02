import { expect } from 'chai';
import { ethers } from 'hardhat';
import { LinkToken, Staking } from '../typechain';
import { Signers } from '../types';
import { getEncodedMerkleProof } from './utils/merkleTree';
import {
  EMPTY_MERKLE_ROOT,
  STAKER_1_ALLOCATION_WEI,
  TEST_MERKLE_ROOT,
  STAKER_1_ADDRESS,
  STAKER_1_MERKLE_PROOF,
} from './utils/mockdata';
import {
  GENERAL_STAKE_AMOUNT,
  INITIAL_MIN_COMMUNITY_STAKE,
  REWARD_AMOUNT,
  REWARD_RATE,
  setupContracts,
} from './utils/setup';

describe('Staking - Access', function () {
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

  describe('#hasAccess', function () {
    beforeEach(async function () {
      await staking.setMerkleRoot(TEST_MERKLE_ROOT);
    });

    describe('when merkle root is set to empty bytes', function () {
      beforeEach(async function () {
        await staking.setMerkleRoot(EMPTY_MERKLE_ROOT);
      });

      it('return true for an invalid proof', async function () {
        expect(await staking.hasAccess(STAKER_1_ADDRESS, [])).to.equal(true);
      });

      it('return true for an invalid address', async function () {
        expect(await staking.hasAccess(ethers.constants.AddressZero, STAKER_1_MERKLE_PROOF)).to.equal(true);
      });

      it('return true for a valid proof', async function () {
        expect(await staking.hasAccess(STAKER_1_ADDRESS, STAKER_1_MERKLE_PROOF)).to.equal(true);
      });
    });

    it('return false for an invalid proof', async function () {
      expect(await staking.hasAccess(STAKER_1_ADDRESS, [])).to.equal(false);
    });

    it('return false for an invalid address', async function () {
      expect(await staking.hasAccess(ethers.constants.AddressZero, STAKER_1_MERKLE_PROOF)).to.equal(false);
    });

    it('return true for a valid proof', async function () {
      expect(await staking.hasAccess(STAKER_1_ADDRESS, STAKER_1_MERKLE_PROOF)).to.equal(true);
    });
  });

  describe('#stake', function () {
    beforeEach(async function () {
      await staking.connect(signers.owner).addOperators(signers.defaultOperators);
      await link.connect(signers.owner).approve(staking.address, REWARD_AMOUNT);
      await staking.connect(signers.owner).start(REWARD_AMOUNT, REWARD_RATE);
    });

    describe('when pool is private', function () {
      describe('when the proof is empty', function () {
        it('reverts', async function () {
          await expect(
            link.connect(signers.communityStaker).transferAndCall(staking.address, GENERAL_STAKE_AMOUNT, []),
          ).to.be.revertedWith('AccessForbidden()');
        });
      });

      describe('when staker is not in the allowlist', function () {
        it('reverts', async function () {
          await expect(
            link.connect(signers.other).transferAndCall(staking.address, STAKER_1_ALLOCATION_WEI, proof),
          ).to.be.revertedWith('AccessForbidden()');
        });
      });

      describe('when staker is in the allowlist', function () {
        it('increases the staked balance', async function () {
          await link.connect(signers.communityStaker).transferAndCall(staking.address, GENERAL_STAKE_AMOUNT, proof);
          const totalStakedAmount = await staking.getTotalStakedAmount();
          expect(totalStakedAmount).to.equal(GENERAL_STAKE_AMOUNT);
        });
      });
    });

    describe('when pool is public', function () {
      beforeEach(async function () {
        await staking.connect(signers.owner).setMerkleRoot(EMPTY_MERKLE_ROOT);
      });

      describe('when empty data is supplied as proof', function () {
        it('increases the staked balance', async function () {
          await link
            .connect(signers.other)
            .transferAndCall(staking.address, INITIAL_MIN_COMMUNITY_STAKE, ethers.utils.formatBytes32String(''));
          const totalStakedAmount = await staking.getTotalStakedAmount();
          expect(totalStakedAmount).to.equal(INITIAL_MIN_COMMUNITY_STAKE);
        });
      });

      describe('when staker is not in the allowlist', function () {
        it('increases the staked balance', async function () {
          await link.connect(signers.other).transferAndCall(staking.address, INITIAL_MIN_COMMUNITY_STAKE, proof);
          const totalStakedAmount = await staking.getTotalStakedAmount();
          expect(totalStakedAmount).to.equal(INITIAL_MIN_COMMUNITY_STAKE);
        });
      });
    });
  });
});
