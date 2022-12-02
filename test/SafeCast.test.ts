import { expect } from 'chai';
import { SafeCastHelper, SafeCastHelper__factory } from '../typechain';
import { getSigners } from './utils/signers';
import { Signers } from '../types';
import { BigNumber } from 'ethers';

describe('SafeCast', function () {
  let signers: Signers;
  let safeCast: SafeCastHelper;

  before(async function () {
    signers = await getSigners();
  });

  beforeEach(async function () {
    safeCast = await new SafeCastHelper__factory(signers.owner).deploy();
  });

  describe('#_toUint8', function () {
    describe('when given a value below the uint8 max', function () {
      it('returns the correct value', async function () {
        const value = BigNumber.from(2).pow(8).sub(1);
        expect(await safeCast.toUint8(value)).to.equal(value);
      });
    });

    describe('when given a value above the uint8 max', function () {
      it('reverts', async function () {
        const value = BigNumber.from(2).pow(8);
        await expect(safeCast.toUint8(value)).to.be.revertedWith(`CastError()`);
      });
    });
  });

  describe('#_toUint32', function () {
    describe('when given a value below the uint32 max', function () {
      it('returns the correct value', async function () {
        const value = BigNumber.from(2).pow(32).sub(1);
        expect(await safeCast.toUint32(value)).to.equal(value);
      });
    });

    describe('when given a value above the uint32 max', function () {
      it('reverts', async function () {
        const value = BigNumber.from(2).pow(32);
        await expect(safeCast.toUint32(value)).to.be.revertedWith(`CastError()`);
      });
    });
  });

  describe('#_toUint80', function () {
    describe('when given a value below the uint80 max', function () {
      it('returns the correct value', async function () {
        const value = BigNumber.from(2).pow(80).sub(1);
        expect(await safeCast.toUint80(value)).to.equal(value);
      });
    });

    describe('when given a value above the uint80 max', function () {
      it('reverts', async function () {
        const value = BigNumber.from(2).pow(80);
        await expect(safeCast.toUint80(value)).to.be.revertedWith(`CastError()`);
      });
    });
  });

  describe('#_toUint96', function () {
    describe('when given a value below the uint96 max', function () {
      it('returns the correct value', async function () {
        const value = BigNumber.from(2).pow(96).sub(1);
        expect(await safeCast.toUint96(value)).to.equal(value);
      });
    });

    describe('when given a value above the uint96 max', function () {
      it('reverts', async function () {
        const value = BigNumber.from(2).pow(96);
        await expect(safeCast.toUint96(value)).to.be.revertedWith(`CastError()`);
      });
    });
  });
});
