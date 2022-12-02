import { expect } from 'chai';
import { Contract } from 'ethers';
import { Signers } from '../types';
import { getSigners } from './utils/signers';

export function shouldBehaveLikeConfirmedOwner(contractName: string, getConfirmedOwner: () => Contract): void {
  let ConfirmedOwner: Contract;
  let signers: Signers;

  describe(`${contractName} shouldBehaveLikeConfirmedOwner`, function () {
    before(async function () {
      signers = await getSigners();
    });

    beforeEach(() => {
      ConfirmedOwner = getConfirmedOwner();
    });

    describe('#constructor', function () {
      it('should assign Owner to the deployer', async function () {
        expect(await ConfirmedOwner.owner()).to.equal(signers.owner.address);
      });
    });

    describe('#transferOwnership', function () {
      it('transfers ownership to the new owner', async function () {
        await expect(ConfirmedOwner.connect(signers.owner).transferOwnership(signers.other.address))
          .to.emit(ConfirmedOwner, 'OwnershipTransferRequested')
          .withArgs(signers.owner.address, signers.other.address);
      });

      it('does not allow owner to transfer to themself', async function () {
        await expect(ConfirmedOwner.connect(signers.owner).transferOwnership(signers.owner.address)).to.be.revertedWith(
          `Cannot transfer to self`,
        );
      });

      it('non-owners cannot transfer ownership', async function () {
        await expect(ConfirmedOwner.connect(signers.other).transferOwnership(signers.other.address)).to.be.revertedWith(
          'Only callable by owner',
        );
      });
    });

    describe('#acceptOwnership', () => {
      it('allows a pending owner to accept ownership', async function () {
        expect(await ConfirmedOwner.owner()).to.equal(signers.owner.address);

        await ConfirmedOwner.connect(signers.owner).transferOwnership(signers.other.address);
        await expect(ConfirmedOwner.connect(signers.other).acceptOwnership())
          .to.emit(ConfirmedOwner, 'OwnershipTransferred')
          .withArgs(signers.owner.address, signers.other.address);

        expect(await ConfirmedOwner.owner()).to.equal(signers.other.address);
      });

      it('does not let non-recipients accept ownership', async function () {
        await expect(ConfirmedOwner.connect(signers.other).acceptOwnership()).to.be.revertedWith(
          'Must be proposed owner',
        );
      });
    });
  });
}
