import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';

import { Signers } from '../../types';

export async function getSigners(): Promise<Signers> {
  const signers: SignerWithAddress[] = await ethers.getSigners();

  const operator = signers[5];
  const operatorTwo = signers[7];
  const operatorThree = signers[8];
  const defaultOperators = [
    operator.address,
    operatorTwo.address,
    operatorThree.address,
    '0x03CaECC16A8726096a3C83d7dE788767D68869E5',
    '0x04e9758136D340b64f2e66B937e49C9de2751615',
    '0x0590f74DCA5Fc558bB43A2b11Db970F48dB31aa4',
    '0x06AA4B79856004e15F05513c5C266156A280b39f',
    '0x075c80D9d900E1AC70eE3Ab88831c1BdC2A1F48a',
    '0x084044D332323923Cfd96949972c389CCF61E925',
    '0x09BeB1e6103f2f176923B9d8726D17582c57c38e',
    '0x107319dF18013D8e85e87e22ED790A3b55285872',
    '0x118095BE092F4a47b7a35239fa5D0ef8316AA74A',
    '0x12b9BD2CE7289ACdAd1556354FCE6F9eA84190cF',
    '0x13fA1b4af43513C1D01C19B99fCeBF4dE8A260B3',
    '0x14aa189AAa8918440D7AfCD12cc03ee737b54C75',
    '0x15C67D0ADfF8a887203a65B4e0f30a9832B0FeE2',
    '0x16014b561ed7ae5a3691474896E93e0fEe2d0495',
    '0x17e20Ee9F829a593052b6597D6b53c4Edf6d882D',
    '0x186205a762Aa49E8f8123C9EdcEA3e0c2B577B7A',
    '0x19E4E9e460f93850B77813F4a0D90a71B7f88Fc1',
    '0x20994305389EdEF03d91bb29F177C7d7505eA4F3',
    '0x21B7B7b7Fb29ba4f8208957f52c121502CC32f26',
    '0x22d0065ECb475319946405E014509E7427AFf4b5',
    '0x23fB1bEb976bF77CbF1d41241e093D8130013aE1',
    '0x24F64Ba9db922C46496314a63ed7541Abb3aF152',
    '0x25D9Ae824bEF93ecdaB17de90829485bA3043b62',
    '0x26E64b65B2CF5A320Ca15d245eb539789Bcb35ad',
    '0x27Deb3AF5e781Ce793F5076C1BF71D008Ed30d50',
    '0x28D10F5B1AF71D15B1E9abe2a0129701F3496f09',
    '0x2991D1d6a2c3c95375f9BA2dcedA75902efCd957',
    '0x30B4022168644a5DA299fd9D85E35d6DB1E065cF',
  ];

  return {
    owner: signers[0],
    other: signers[1],
    alice: signers[2],
    bob: signers[3],
    charlie: signers[4],
    communityStaker: signers[6],
    operator,
    operatorTwo,
    operatorThree,
    defaultOperators,
  };
}
