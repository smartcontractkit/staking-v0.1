// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {EnumerableSet} from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import {LinkTokenInterface} from '@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol';
import {IStaking} from '../../../contracts/interfaces/IStaking.sol';

library CommunityStakerLib {
  using EnumerableSet for EnumerableSet.AddressSet;

  struct CommunityStakerDetails {
    uint256 stake;
  }

  struct CommunityStakers {
    EnumerableSet.AddressSet _addresses;
    EnumerableSet.AddressSet _addressesWithStake;
    mapping(address => CommunityStakerDetails) _details;
  }

  // ==========================================================================
  // ACTIONS
  // ==========================================================================

  function create(
    CommunityStakers storage communityStakers,
    address newCommunityStakerAddress
  ) public {
    communityStakers._addresses.add(newCommunityStakerAddress);
  }

  function stake(
    CommunityStakers storage communityStakers,
    address stakerAddress,
    uint256 amount
  ) public {
    communityStakers._details[stakerAddress].stake += amount;
    communityStakers._addressesWithStake.add(stakerAddress);
  }

  function unstake(
    CommunityStakers storage communityStakers,
    address stakerAddress
  ) public {
    delete communityStakers._details[stakerAddress].stake;
    communityStakers._addressesWithStake.remove(stakerAddress);
  }

  // ==========================================================================
  // VIEW FUNCTIONS
  // ==========================================================================

  function getCommunityStaker(
    CommunityStakers storage communityStakers,
    uint256 index
  ) public view returns (address) {
    return communityStakers._addresses.at(index);
  }

  function getCommunityStakers(CommunityStakers storage communityStakers)
    public
    view
    returns (address[] memory)
  {
    return communityStakers._addresses.values();
  }

  function getCommunityStakersWithStake(
    CommunityStakers storage communityStakers
  ) public view returns (address[] memory) {
    return communityStakers._addressesWithStake.values();
  }
}
