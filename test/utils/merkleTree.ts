import { ethers } from 'hardhat';
import MerkleTree from 'merkletreejs';
import { generateLeaf } from '../../lib/generator';

export function getMerkleProof(tree: MerkleTree, address: string) {
  const leaf = generateLeaf(address);
  return tree.getHexProof(leaf);
}

export function getEncodedMerkleProof(tree: MerkleTree, address: string) {
  return ethers.utils.defaultAbiCoder.encode(['bytes32[]'], [getMerkleProof(tree, address)]);
}
