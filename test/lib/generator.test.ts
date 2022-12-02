import { expect } from 'chai';
import { generateMerkleTree, verifyMerkleProof } from '../../lib/generator';
import {
  TEST_SNAPSHOT,
  TEST_MERKLE_ROOT,
  STAKER_1_MERKLE_PROOF,
  STAKER_1_ADDRESS,
} from '../utils/mockdata';

describe('generator', function () {
  describe('generateMerkleTree', function () {
    it('returns a merkle tree', async function () {
      const allowlist = Object.keys(TEST_SNAPSHOT);
      const tree = generateMerkleTree(allowlist);

      expect(tree.getHexRoot()).to.equal(TEST_MERKLE_ROOT);
      expect(tree.getHexLeaves()).to.eql([
        '0x35e369283fe7cefef255362907d785489c45a560c2338965d77c6f8276c0f43d',
        '0x028788d85ac101a6d28d6fa4c8068ecf15dcf6905c528cd4d9d140f183c52e57',
        '0x8ab7285125b4809dc71990af3b4fc609e03e15eec38bd5d05dafdc99766966b7',
        '0xae0eed73539f2f765c9f0948dfdf55b7d8e0b0cc7934c43d1dc655afa82b2068',
        '0x837edd633d414cd75d6487d54439b3937a135c6999e766e203b422d7a298cdd0',
      ]);
      expect(tree.getHexLeaves().map(l => tree.getHexProof(l))).to.eql([
        STAKER_1_MERKLE_PROOF,
        [
          '0x35e369283fe7cefef255362907d785489c45a560c2338965d77c6f8276c0f43d',
          '0xb10e166d0911e4c1a50fc331a9ec94e41949261af36e4280d1f754e0ca9861c8',
          '0x837edd633d414cd75d6487d54439b3937a135c6999e766e203b422d7a298cdd0',
        ],
        [
          '0xae0eed73539f2f765c9f0948dfdf55b7d8e0b0cc7934c43d1dc655afa82b2068',
          '0xbcd72bde95e8033e789007c4480dfc974b81fa344bd246cb0b3383e5980d2cd0',
          '0x837edd633d414cd75d6487d54439b3937a135c6999e766e203b422d7a298cdd0',
        ],
        [
          '0x8ab7285125b4809dc71990af3b4fc609e03e15eec38bd5d05dafdc99766966b7',
          '0xbcd72bde95e8033e789007c4480dfc974b81fa344bd246cb0b3383e5980d2cd0',
          '0x837edd633d414cd75d6487d54439b3937a135c6999e766e203b422d7a298cdd0',
        ],
        ['0xdbf6b86c4fc122a1320c05514bd811e6413b4480d5adc6de2c5a291fb5ce37f0'],
      ]);
    });
  });

  describe('verifyProof', function () {
    it('verifies a valid merkle proof', async function () {
      expect(
        verifyMerkleProof({
          merkleRoot: TEST_MERKLE_ROOT,
          merkleProof: STAKER_1_MERKLE_PROOF,
          address: STAKER_1_ADDRESS,
        }),
      ).to.equal(true);
    });
  });
});
