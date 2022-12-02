import { assert } from 'chai';
import { Contract, ContractTransaction } from 'ethers';
import { ethers } from 'hardhat';
/**
 * Check that a contract's abi exposes the expected interface.
 *
 * @param contract The contract with the actual abi to check the expected exposed methods and getters against.
 * @param expectedPublic The expected public exposed methods and getters to match against the actual abi.
 */
export function publicAbi(contract: Contract, expectedPublic: string[]): void {
  const actualPublic: string[] = [];
  for (const m in contract.functions) {
    if (!m.includes('(')) {
      actualPublic.push(m);
    }
  }

  const unexpectedPublicMethods = actualPublic.reduce((acc, method) => {
    if (!expectedPublic.includes(method)) {
      acc.push(method);
    }
    return acc;
  }, [] as string[]);

  assert.isEmpty(unexpectedPublicMethods, `'${unexpectedPublicMethods.join("', '")}' should NOT be public`);

  const missingPublicMethods = expectedPublic.reduce((acc, method) => {
    if (!actualPublic.includes(method)) {
      acc.push(method);
    }
    return acc;
  }, [] as string[]);

  assert.isEmpty(missingPublicMethods, `'${missingPublicMethods.join("', '")}' should be public`);
}

export const getTxTimestamp = async (tx: ContractTransaction): Promise<number> => {
  const receipt = await tx.wait();
  const { timestamp } = await ethers.provider.getBlock(receipt.blockNumber);
  return timestamp;
};
