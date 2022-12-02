// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import 'forge-std/Test.sol';
import {LinkTokenInterface} from '@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol';
import {IStaking} from '../../../contracts/interfaces/IStaking.sol';
import {IStakingOwner} from '../../../contracts/interfaces/IStakingOwner.sol';
import {CommunityStakerLib} from '../helpers/CommunityStakerLib.t.sol';
import {OperatorLib} from '../helpers/OperatorLib.t.sol';
import {Constants} from '../Constants.t.sol';

contract ActorManager is Constants, Test {
  using CommunityStakerLib for CommunityStakerLib.CommunityStakers;
  using OperatorLib for OperatorLib.Operators;
  CommunityStakerLib.CommunityStakers private s_communityStakers;
  OperatorLib.Operators private s_operators;

  IStaking private immutable i_staking;
  IStakingOwner private immutable i_stakingOwner;
  LinkTokenInterface private immutable i_link;

  uint256 private operatorAddressIndex;
  uint256 private communityStakerAddressIndex;
  uint256 private s_lastAlertRoundId;

  constructor(
    IStaking staking,
    IStakingOwner stakingOwner,
    LinkTokenInterface link
  ) {
    i_staking = staking;
    i_stakingOwner = stakingOwner;
    i_link = link;
  }

  // ==========================================================================
  // ACTIONS (OPERATORS)
  // ==========================================================================

  function createAndAddOperators(uint256 newOperatorsCount) public {
    changePrank(OWNER);
    address[] memory newOperators = new address[](newOperatorsCount);

    for (uint256 i; i < newOperatorsCount; i++) {
      address newOperatorAddress = address(uint160(operatorAddressIndex + 100));
      operatorAddressIndex++;

      s_operators.create(newOperatorAddress);

      vm.deal(newOperatorAddress, 100 ether);
      i_link.transfer(newOperatorAddress, INITIAL_MAX_OPERATOR_STAKE * 2);
      newOperators[i] = newOperatorAddress;
    }

    i_stakingOwner.addOperators(newOperators);
  }

  function operatorRemove(address operatorAddress) public {
    s_operators.remove(operatorAddress);
  }

  function operatorStake(address operatorAddress, uint256 amount) public {
    s_operators.stake(operatorAddress, amount);
  }

  function operatorUnstake(address operatorAddress) public {
    s_operators.unstake(operatorAddress);
  }

  function operatorWithdrawRemovedStake(address operatorAddress) public {
    s_operators.withdrawRemovedStake(operatorAddress);
  }

  // ==========================================================================
  // ACTIONS (COMMUNITY STAKERS)
  // ==========================================================================

  function createCommunityStakers(uint256 newCommunityStakersCount) public {
    changePrank(OWNER);
    for (uint256 i; i < newCommunityStakersCount; i++) {
      address newCommunityStakerAddress = address(
        uint160(communityStakerAddressIndex + 100_000)
      );
      communityStakerAddressIndex++;

      s_communityStakers.create(newCommunityStakerAddress);

      vm.deal(newCommunityStakerAddress, 100 ether);
      i_link.transfer(newCommunityStakerAddress, INITIAL_MAX_COMMUNITY_STAKE);
    }
  }

  function communityStakerStake(address communityStakerAddress, uint256 amount)
    public
  {
    s_communityStakers.stake(communityStakerAddress, amount);
  }

  function communityStakerUnstake(address communityStakerAddress) public {
    s_communityStakers.unstake(communityStakerAddress);
  }

  // ==========================================================================
  // ACTIONS (SHARED)
  // ==========================================================================

  function alert(uint256 roundId) public {
    s_lastAlertRoundId = roundId;
  }

  // ==========================================================================
  // VIEW FUNCTIONS (OPERATORS)
  // ==========================================================================

  function getRandomOperatorAddress(uint256 seed) public returns (address) {
    uint256 operatorsCount = s_operators.getOperators().length - 1;
    return s_operators.getOperator(bound(seed, 0, operatorsCount));
  }

  function getRandomRemovedOperatorAddressWithStake(uint256 seed)
    public
    returns (address)
  {
    address[] memory removedOperators = s_operators
      .getRemovedOperatorsWithStake();

    // Return address(0) if there are no removed operators with stake
    if (removedOperators.length == 0) return address(0);

    uint256 operatorsCount = removedOperators.length - 1;
    return removedOperators[bound(seed, 0, operatorsCount)];
  }

  function getRandomOperatorAddressWithStake(uint256 seed)
    public
    returns (address)
  {
    address[] memory operatorsWithStake = s_operators.getOperatorsWithStake();
    if (operatorsWithStake.length == 0) return address(0);

    uint256 operatorsWithStakeCount = operatorsWithStake.length - 1;
    return operatorsWithStake[bound(seed, 0, operatorsWithStakeCount)];
  }

  function getOperators() public view returns (address[] memory) {
    return s_operators.getOperators();
  }

  function getActiveOperators() public view returns (address[] memory) {
    return s_operators.getActiveOperators();
  }

  // ==========================================================================
  // VIEW FUNCTIONS (COMMUNITY STAKERS)
  // ==========================================================================

  function getRandomCommunityStakerAddress(uint256 seed)
    public
    returns (address)
  {
    address[] memory communityStakers = s_communityStakers
      .getCommunityStakers();
    if (communityStakers.length == 0) return address(0);

    uint256 communityStakersCount = communityStakers.length - 1;
    return communityStakers[bound(seed, 0, communityStakersCount)];
  }

  function getRandomCommunityStakerAddressWithStake(uint256 seed)
    public
    returns (address)
  {
    address[] memory communityStakers = s_communityStakers
      .getCommunityStakersWithStake();
    if (communityStakers.length == 0) return address(0);

    uint256 communityStakersCount = communityStakers.length - 1;
    return communityStakers[bound(seed, 0, communityStakersCount)];
  }

  // ==========================================================================
  // VIEW FUNCTIONS (SHARED)
  // ==========================================================================

  function getLastAlertRoundId() public view returns (uint256) {
    return s_lastAlertRoundId;
  }
}
