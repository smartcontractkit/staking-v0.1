import { MockContract } from 'ethereum-waffle';
import hre, { ethers } from 'hardhat';
import MerkleTree from 'merkletreejs';
import { generateMerkleTree } from '../../lib/generator';
import {
  LinkToken,
  LinkToken__factory,
  RewardLib,
  RewardLib__factory,
  Staking,
  StakingPoolLib,
  StakingPoolLib__factory,
  Staking__factory,
} from '../../typechain';
import { Signers } from '../../types';
import { deployMockFeed } from './mocks';
import { getSigners } from './signers';

export const SEVEN_DAYS = 7 * 24 * 60 * 60;
export const ONE_MONTH = 30 * 24 * 60 * 60;
/// Example rate calculation
/// 60 * 60 * 24 * 365 = 31,536,000 approximate number of seconds in a year
/// 10^12 is the reward precision
/// 10^12 * 0.01 / 31,536,000 = 317
/// constant rate of 1% per year per LINK staked
export const REWARD_RATE = ethers.BigNumber.from(317);
export const LOW_REWARD_RATE = ethers.BigNumber.from(95); // 0.3% lower bound; 10^12 * 0.003 / 31,536,000 = 95
export const HIGH_REWARD_RATE = ethers.BigNumber.from(15_855); // 50% upper bound; 10^12 * 0.5 / 31,536,000 = 15_855
export const MAX_POOL_SIZE = ethers.BigNumber.from(25_000_000);
const INITIAL_BALANCE_AMOUNT = 100_000_000;
export const DELEGATION_RATE_DENOMINATOR = 100;
export const MULTIPLIER = ethers.utils.parseUnits('1', 18);
export const REWARD_PRECISION = ethers.utils.parseUnits('1', 12);
export const REWARD_DURATION = ONE_MONTH * 6;
export const INITIAL_BALANCE = ethers.utils.parseUnits(INITIAL_BALANCE_AMOUNT.toString(), 18);
export const INITIAL_MAX_POOL_SIZE = ethers.utils.parseUnits(MAX_POOL_SIZE.toString(), 18);
export const INITIAL_MIN_COMMUNITY_STAKE = ethers.utils.parseUnits('1', 18); // 1 LINK
export const INITIAL_MAX_COMMUNITY_STAKE = ethers.utils.parseUnits('7000', 18);
export const INITIAL_MIN_OPERATOR_STAKE = ethers.utils.parseUnits('1000', 18);
export const INITIAL_MAX_OPERATOR_STAKE = ethers.utils.parseUnits('50000', 18);
export const REWARD_AMOUNT = ethers.BigNumber.from(MAX_POOL_SIZE).mul(REWARD_RATE).mul(1_000_000).mul(REWARD_DURATION);
export const INITIAL_START_TIMESTAMP = 2 * 10 ** 9;
export const GENERAL_STAKE_AMOUNT = INITIAL_MIN_OPERATOR_STAKE;
export const DUMMY_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
export const TEST_ROUND_ID = 123;
export const PRIORITY_PERIOD_THRESHOLD_SECONDS = 3 * 60 * 60; // 3 hours
export const PRIORITY_ROUND_THRESHOLD_SECONDS = 20 * 60; // 20 minutes
export const REGULAR_PERIOD_THRESHOLD_SECONDS = PRIORITY_PERIOD_THRESHOLD_SECONDS + PRIORITY_ROUND_THRESHOLD_SECONDS;
export const MAX_ALERTING_REWARD_AMOUNT = ethers.utils.parseUnits('7000', 18);
export const DUMMY_BYTES = ethers.utils.formatBytes32String('foo');
export const MIN_INITIAL_OPERATOR_COUNT = 31;
export const MIN_REWARD_DURATION = 30 * 24 * 60 * 60; // 30 days
export const SLASHABLE_DURATION = 90 * 24 * 60 * 60; // 90 days

export async function setupContracts(): Promise<{
  signers: Signers;
  link: LinkToken;
  staking: Staking;
  rewardLib: RewardLib;
  stakingPoolLib: StakingPoolLib;
  feed: MockContract;
  merkleTree: MerkleTree;
}> {
  const [signers] = await Promise.all([await getSigners(), await hre.network.provider.send('hardhat_reset')]);
  const link: LinkToken = await new LinkToken__factory(signers.owner).deploy();

  const feed = await deployMockFeed(signers.owner);

  const [rewardLib, stakingPoolLib, staking] = await Promise.all([
    new RewardLib__factory(signers.owner).deploy(),
    new StakingPoolLib__factory(signers.owner).deploy(),
    new Staking__factory(signers.owner).deploy({
      LINKAddress: link.address,
      monitoredFeed: feed.address,
      initialMaxPoolSize: INITIAL_MAX_POOL_SIZE,
      initialMaxCommunityStakeAmount: INITIAL_MAX_COMMUNITY_STAKE,
      initialMaxOperatorStakeAmount: INITIAL_MAX_OPERATOR_STAKE,
      minCommunityStakeAmount: INITIAL_MIN_COMMUNITY_STAKE,
      minOperatorStakeAmount: INITIAL_MIN_OPERATOR_STAKE,
      priorityPeriodThreshold: PRIORITY_PERIOD_THRESHOLD_SECONDS,
      regularPeriodThreshold: REGULAR_PERIOD_THRESHOLD_SECONDS,
      maxAlertingRewardAmount: MAX_ALERTING_REWARD_AMOUNT,
      minInitialOperatorCount: MIN_INITIAL_OPERATOR_COUNT,
      minRewardDuration: MIN_REWARD_DURATION,
      slashableDuration: SLASHABLE_DURATION,
      delegationRateDenominator: DELEGATION_RATE_DENOMINATOR,
    }),
    // Transfers tokens to test accounts
    link.transfer(signers.communityStaker.address, INITIAL_BALANCE),
    link.transfer(signers.owner.address, INITIAL_BALANCE),
    link.transfer(signers.operator.address, INITIAL_BALANCE),
    link.transfer(signers.operatorTwo.address, INITIAL_BALANCE),
    link.transfer(signers.operatorThree.address, INITIAL_BALANCE),
    link.transfer(signers.other.address, INITIAL_BALANCE),
    link.transfer(signers.alice.address, INITIAL_BALANCE),
    link.transfer(signers.bob.address, INITIAL_BALANCE),
  ]);

  // Create MerkleTree
  const { communityStaker, alice, bob } = signers;
  const merkleTree = generateMerkleTree([communityStaker.address, alice.address, bob.address]);
  await staking.connect(signers.owner).setMerkleRoot(merkleTree.getRoot());

  return {
    signers,
    link,
    staking,
    rewardLib,
    stakingPoolLib,
    feed,
    merkleTree,
  };
}
