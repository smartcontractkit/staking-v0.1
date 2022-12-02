import { expect } from 'chai';
import { publicAbi } from './utils/helpers';
import { ConfirmedOwnerTestHelper, ConfirmedOwnerTestHelper__factory } from '../typechain';
import { getSigners } from './utils/signers';
import { Signers } from '../types';
import { ethers } from 'hardhat';

describe('ConfirmedOwner', function () {
  let signers: Signers;
  let confirmedOwner: ConfirmedOwnerTestHelper;

  before(async function () {
    signers = await getSigners();
  });

  beforeEach(async function () {
    confirmedOwner = await new ConfirmedOwnerTestHelper__factory(signers.owner).deploy(signers.owner.address);
  });

  it('has a limited public interface [ @skip-coverage ]', async function () {
    publicAbi(confirmedOwner, [
      'acceptOwnership',
      'owner',
      'transferOwnership',
      // test helper public methods
      'modifierOnlyOwner',
    ]);
  });

  describe('when called by an owner', function () {
    it('successfully calls the method', async function () {
      await expect(confirmedOwner.modifierOnlyOwner()).to.emit(confirmedOwner, 'Here');
    });
  });

  describe('when called by anyone but the owner', function () {
    it('reverts', async function () {
      await expect(confirmedOwner.connect(signers.other).modifierOnlyOwner()).to.be.revertedWith(
        'Only callable by owner',
      );
    });
  });

  describe('when deployed with address 0 as the new owner', function () {
    it('reverts', async function () {
      await expect(
        new ConfirmedOwnerTestHelper__factory(signers.owner).deploy(ethers.constants.AddressZero),
      ).to.be.revertedWith(`Cannot set owner to zero`);
    });
  });
});
