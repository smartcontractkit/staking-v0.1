import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

export interface Signers {
  owner: SignerWithAddress;
  operator: SignerWithAddress;
  operatorTwo: SignerWithAddress;
  operatorThree: SignerWithAddress;
  communityStaker: SignerWithAddress;
  other: SignerWithAddress;
  alice: SignerWithAddress;
  bob: SignerWithAddress;
  charlie: SignerWithAddress;
  defaultOperators: string[];
}
