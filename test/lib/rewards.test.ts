import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { getAlerterReward } from '../utils/rewards';
import { INITIAL_MAX_COMMUNITY_STAKE, MAX_ALERTING_REWARD_AMOUNT } from '../utils/setup';

describe('#getAlerterReward', function () {
  describe('when in priority period', function () {
    it('returns the fixed priority period reward', function () {
      const rewardAmount = getAlerterReward({
        isRegularPeriod: false,
        stakeAmount: BigNumber.from(0),
      });
      expect(rewardAmount).to.equal(MAX_ALERTING_REWARD_AMOUNT);
    });
  });

  describe('when in regular period', function () {
    it('returns half of the staked amount', function () {
      const rewardAmount = getAlerterReward({
        isRegularPeriod: true,
        stakeAmount: INITIAL_MAX_COMMUNITY_STAKE,
      });
      expect(rewardAmount).to.equal(INITIAL_MAX_COMMUNITY_STAKE.div(5));
    });

    it('caps the reward at the priority period alerter reward amount', function () {
      const rewardAmount = getAlerterReward({
        isRegularPeriod: true,
        stakeAmount: ethers.utils.parseUnits('100001', 18),
      });
      expect(rewardAmount).to.equal(MAX_ALERTING_REWARD_AMOUNT);
    });
  });
});
