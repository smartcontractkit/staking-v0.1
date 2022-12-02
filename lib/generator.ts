import { ethers } from 'hardhat'
import MerkleTree from 'merkletreejs';
import { getAddress } from 'ethers/lib/utils';

const DEFAULT_MERKLE_TREE_OPTIONS = { sortPairs: true };

export function generateLeaf(address: string): Buffer {
  const encodedData = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['address'], [getAddress(address)])).slice(2)
  return Buffer.from(encodedData, 'hex');
}

export function generateMerkleTree(allowlist: string[]): MerkleTree {
  return new MerkleTree(allowlist.map(generateLeaf), ethers.utils.keccak256, DEFAULT_MERKLE_TREE_OPTIONS);
}

export function verifyMerkleProof({
  address,
  merkleProof,
  merkleRoot,
}: {
  address: string;
  merkleProof: string[];
  merkleRoot: string;
}): boolean {
  return MerkleTree.verify(merkleProof, generateLeaf(address), merkleRoot, ethers.utils.keccak256, DEFAULT_MERKLE_TREE_OPTIONS);
}
