import hre from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Artifact } from 'hardhat/types';
import { deployMockContract, MockContract } from 'ethereum-waffle';

export async function deployMockFeed(owner: SignerWithAddress): Promise<MockContract> {
  const aggregatorArtifact: Artifact = await hre.artifacts.readArtifact('AggregatorV3Interface');
  const contract = await deployMockContract(owner, aggregatorArtifact.abi);
  return contract;
}
