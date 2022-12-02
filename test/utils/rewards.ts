import { BigNumber } from 'ethers';
import { REWARD_PRECISION, MAX_ALERTING_REWARD_AMOUNT, DELEGATION_RATE_DENOMINATOR, REWARD_RATE } from './setup';

export function getAlerterReward({
  isRegularPeriod,
  stakeAmount,
}: {
  isRegularPeriod?: boolean;
  stakeAmount: BigNumber;
}) {
  if (isRegularPeriod) {
    const regularReward = stakeAmount.div(5);
    return regularReward.gt(MAX_ALERTING_REWARD_AMOUNT) ? MAX_ALERTING_REWARD_AMOUNT : regularReward;
  }
  return MAX_ALERTING_REWARD_AMOUNT;
}

export function getBaseReward({
  stakeAmount,
  secondsStaked = 1,
  isTokenholder = true,
  rewardRate = REWARD_RATE,
}: {
  stakeAmount: BigNumber;
  secondsStaked?: number;
  isTokenholder?: boolean;
  rewardRate?: BigNumber;
}) {
  const eligibleAmount = isTokenholder ? stakeAmount.sub(stakeAmount.div(DELEGATION_RATE_DENOMINATOR)) : stakeAmount;
  return eligibleAmount.mul(rewardRate).mul(secondsStaked).div(REWARD_PRECISION);
}

type DelegatedRewardInput = {
  amount: BigNumber;
  seconds: number;
  rewardRate?: BigNumber;
};

export function getDelegationReward({
  delegatesCount = 1,
  inputs,
}: {
  delegatesCount?: number;
  inputs: DelegatedRewardInput[];
}) {
  return inputs
    .reduce((acc, { amount, seconds, rewardRate }) => {
      const delegatedAmount = amount.div(DELEGATION_RATE_DENOMINATOR);
      const reward = delegatedAmount
        .mul(rewardRate || REWARD_RATE)
        .mul(seconds)
        .div(REWARD_PRECISION);
      return acc.add(reward);
    }, BigNumber.from('0'))
    .div(delegatesCount);
}
