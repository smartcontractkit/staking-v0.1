import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import 'hardhat-deploy';
import '@nomiclabs/hardhat-ethers';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
import 'solidity-docgen';
import 'hardhat-contract-sizer';
import './tools/tasks/accounts';
import './tools/tasks/clean';
import '@nomiclabs/hardhat-etherscan';

import { resolve } from 'path';
import { config as dotenvConfig } from 'dotenv';
import { HardhatUserConfig } from 'hardhat/types';
import { ethers } from 'ethers';
import { TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS } from 'hardhat/builtin-tasks/task-names';
import { subtask } from 'hardhat/config';
import { EtherscanUserConfig } from '@nomiclabs/hardhat-etherscan/dist/src/types';
dotenvConfig({ path: resolve(__dirname, './.env') });

// Turn off ethers "Duplicate definition" warnings
// "Duplicate definition of Transfer (Transfer(address,address,uint256,bytes), Transfer(address,address,uint256))"
ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

// prune forge style tests from hardhat paths
subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS).setAction(async (_, __, runSuper) => {
  const paths = await runSuper();
  return paths.filter((p: string) => !p.endsWith('.t.sol'));
});

// Ensure that we have all the environment variables we need.
let mnemonic: string;
if (!process.env.MNEMONIC) {
  throw new Error('Please set your MNEMONIC in a .env file');
} else {
  mnemonic = process.env.MNEMONIC;
}
const accounts = {
  mnemonic,
};

const viaIr: boolean = process.env.VIA_IR == 'true';

interface HardhatConfig extends HardhatUserConfig {
  etherscan: EtherscanUserConfig;
}

const config: HardhatConfig = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      accounts,
      chainId: 31337,
    },
    mainnet: {
      url: `${process.env.NODE_URL}`,
    },
    kovan: {
      url: `${process.env.NODE_URL}`,
      accounts,
      chainId: 42,
    },
    goerli: {
      url: `${process.env.NODE_URL}`,
      chainId: 5,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  paths: {
    artifacts: './artifacts',
    cache: './cache',
    sources: './contracts',
    tests: './test',
  },
  solidity: {
    compilers: [
      {
        version: '0.4.24',
      },
      {
        version: '0.8.16',
        settings: {
          optimizer: {
            enabled: true,
            runs: 75000,
          },
          viaIR: viaIr,
          metadata: {
            bytecodeHash: 'none',
          },
        },
      },
    ],
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
  },
  gasReporter: {
    currency: 'USD',
    gasPrice: 50,
    enabled: process.env.DISABLE_GAS_REPORT ? false : true,
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
  },
  docgen: {
    exclude: ['./tests'],
  },
};

export default config;
