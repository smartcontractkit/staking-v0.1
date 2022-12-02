import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployMockContract, MockContract } from "ethereum-waffle";

export const deployMockLinkTokenReceiver = async function(signer: SignerWithAddress): Promise<MockContract> {
    const mockABI = [
        {
          inputs: [
            {
              internalType: 'bytes4',
              name: 'interfaceID',
              type: 'bytes4',
            },
          ],
          name: 'supportsInterface',
          outputs: [
            {
              internalType: 'bool',
              name: 'success',
              type: 'bool',
            },
          ],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ];
      return await deployMockContract(signer, mockABI);
}
