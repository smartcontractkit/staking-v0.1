# Solidity API

## RewardLib

### RewardInitialized

```solidity
event RewardInitialized(uint256 rate, uint256 available, uint256 startTimestamp, uint256 endTimestamp)
```

emitted when the reward is initialized for the first time

#### Parameters

| Name           | Type    | Description                                                          |
| -------------- | ------- | -------------------------------------------------------------------- |
| rate           | uint256 | the reward rate                                                      |
| available      | uint256 | the amount of rewards available for distribution in the staking pool |
| startTimestamp | uint256 | the start timestamp when rewards are started                         |
| endTimestamp   | uint256 | the timestamp when the reward will run out                           |

### RewardRateChanged

```solidity
event RewardRateChanged(uint256 rate)
```

emitted when owner changes the reward rate

#### Parameters

| Name | Type    | Description         |
| ---- | ------- | ------------------- |
| rate | uint256 | the new reward rate |

### RewardAdded

```solidity
event RewardAdded(uint256 amountAdded)
```

emitted when owner adds more rewards to the pool

#### Parameters

| Name        | Type    | Description                                  |
| ----------- | ------- | -------------------------------------------- |
| amountAdded | uint256 | the amount of LINK rewards added to the pool |

### RewardWithdrawn

```solidity
event RewardWithdrawn(uint256 amount)
```

emitted when owner withdraws unreserved rewards

#### Parameters

| Name   | Type    | Description                     |
| ------ | ------- | ------------------------------- |
| amount | uint256 | the amount of rewards withdrawn |

### RewardSlashed

```solidity
event RewardSlashed(address[] operator, uint256[] slashedBaseRewards, uint256[] slashedDelegatedRewards)
```

emitted when an on feed operator gets slashed.
Node operators are not slashed more than the amount of rewards they
have earned. This means that a node operator that has not
accumulated at least two weeks of rewards will be slashed
less than an operator that has accumulated at least
two weeks of rewards.

### RewardDurationTooShort

```solidity
error RewardDurationTooShort()
```

This error is thrown when the updated reward duration is less than a month

### REWARD_PRECISION

```solidity
uint256 REWARD_PRECISION
```

This is the reward calculation precision variable. LINK token has the
1e18 multiplier which means that rewards are floored after 6 decimals
points. Micro LINK is the smallest unit that is eligible for rewards.

### DelegatedRewards

```solidity
struct DelegatedRewards {
  uint8 delegatesCount;
  uint96 cumulativePerDelegate;
  uint32 lastAccumulateTimestamp;
}

```

### BaseRewards

```solidity
struct BaseRewards {
  uint80 rate;
  uint96 cumulativePerMicroLINK;
  uint32 lastAccumulateTimestamp;
}

```

### MissedRewards

```solidity
struct MissedRewards {
  uint96 base;
  uint96 delegated;
}

```

### ReservedRewards

```solidity
struct ReservedRewards {
  uint96 base;
  uint96 delegated;
}

```

### Reward

```solidity
struct Reward {
  mapping(address => struct RewardLib.MissedRewards) missed;
  struct RewardLib.DelegatedRewards delegated;
  struct RewardLib.BaseRewards base;
  struct RewardLib.ReservedRewards reserved;
  uint256 endTimestamp;
  uint32 startTimestamp;
}
```

### \_initialize

```solidity
function _initialize(struct RewardLib.Reward reward, uint256 maxPoolSize, uint256 rate, uint256 minRewardDuration, uint256 availableReward) internal
```

initializes the reward with the defined parameters

_can only be called once. Any future reward changes have to be done
using specific functions._

#### Parameters

| Name              | Type                    | Description                                           |
| ----------------- | ----------------------- | ----------------------------------------------------- |
| reward            | struct RewardLib.Reward |                                                       |
| maxPoolSize       | uint256                 | maximum pool size that the reward is initialized with |
| rate              | uint256                 | reward rate                                           |
| minRewardDuration | uint256                 | the minimum duration rewards need to last for         |
| availableReward   | uint256                 | available reward amount                               |

### \_isDepleted

```solidity
function _isDepleted(struct RewardLib.Reward reward) internal view returns (bool)
```

#### Return Values

| Name | Type | Description                                     |
| ---- | ---- | ----------------------------------------------- |
| [0]  | bool | bool true if the reward is expired (end <= now) |

### \_accumulateBaseRewards

```solidity
function _accumulateBaseRewards(struct RewardLib.Reward reward) internal
```

Helper function to accumulate base rewards
Accumulate reward per micro LINK before changing reward rate.
This keeps rewards prior to rate change unaffected.

### \_accumulateDelegationRewards

```solidity
function _accumulateDelegationRewards(struct RewardLib.Reward reward, uint256 delegatedAmount) internal
```

Helper function to accumulate delegation rewards

_This function is necessary to correctly account for any changes in
eligible operators, delegated amount or reward rate._

### \_calculateReward

```solidity
function _calculateReward(struct RewardLib.Reward reward, uint256 amount, uint256 duration) internal view returns (uint256)
```

Helper function to calculate rewards

#### Parameters

| Name     | Type                    | Description                                               |
| -------- | ----------------------- | --------------------------------------------------------- |
| reward   | struct RewardLib.Reward |                                                           |
| amount   | uint256                 | a staked amount to calculate rewards for                  |
| duration | uint256                 | a duration that the specified amount receives rewards for |

#### Return Values

| Name | Type    | Description   |
| ---- | ------- | ------------- |
| [0]  | uint256 | rewardsAmount |

### \_calculateAccruedDelegatedRewards

```solidity
function _calculateAccruedDelegatedRewards(struct RewardLib.Reward reward, uint256 totalDelegatedAmount) internal view returns (uint256)
```

Calculates the amount of delegated rewards accumulated so far.

_This function takes into account the amount of delegated
rewards accumulated from previous delegate counts and amounts and
the latest additional value._

### \_calculateAccruedBaseRewards

```solidity
function _calculateAccruedBaseRewards(struct RewardLib.Reward reward, uint256 amount) internal view returns (uint256)
```

Calculates the amount of rewards accrued so far.

_This function takes into account the amount of
rewards accumulated from previous rates in addition to
the rewards that will be accumulated based off the current rate
over a given duration._

### \_calculateConcludedBaseRewards

```solidity
function _calculateConcludedBaseRewards(struct RewardLib.Reward reward, uint256 amount, address staker) internal view returns (uint256)
```

We use a simplified reward calculation formula because we know that
the reward is expired. We accumulate reward per micro LINK
before concluding the pool so we can avoid reading additional storage
variables.

### \_updateReservedRewards

```solidity
function _updateReservedRewards(struct RewardLib.Reward reward, uint256 baseRewardAmount, uint256 delegatedRewardAmount, bool isReserving) private
```

Reserves staker rewards. This is necessary to make sure that
there are always enough available LINK tokens for all stakers until the
reward end timestamp. The amount is calculated for the remaining reward
duration using the current reward rate.

#### Parameters

| Name                  | Type                    | Description                                                                                           |
| --------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------- |
| reward                | struct RewardLib.Reward |                                                                                                       |
| baseRewardAmount      | uint256                 | The amount of base rewards to reserve or unreserve for                                                |
| delegatedRewardAmount | uint256                 | The amount of delegated rewards to reserve or unreserve for                                           |
| isReserving           | bool                    | true if function should reserve more rewards. false will unreserve and deduct from the reserved total |

### \_reserve

```solidity
function _reserve(struct RewardLib.Reward reward, uint256 baseRewardAmount, uint256 delegatedRewardAmount) internal
```

Increase reserved staker rewards.

#### Parameters

| Name                  | Type                    | Description                                                 |
| --------------------- | ----------------------- | ----------------------------------------------------------- |
| reward                | struct RewardLib.Reward |                                                             |
| baseRewardAmount      | uint256                 | The amount of base rewards to reserve or unreserve for      |
| delegatedRewardAmount | uint256                 | The amount of delegated rewards to reserve or unreserve for |

### \_unreserve

```solidity
function _unreserve(struct RewardLib.Reward reward, uint256 baseRewardAmount, uint256 delegatedRewardAmount) internal
```

Decrease reserved staker rewards.

#### Parameters

| Name                  | Type                    | Description                                                 |
| --------------------- | ----------------------- | ----------------------------------------------------------- |
| reward                | struct RewardLib.Reward |                                                             |
| baseRewardAmount      | uint256                 | The amount of base rewards to reserve or unreserve for      |
| delegatedRewardAmount | uint256                 | The amount of delegated rewards to reserve or unreserve for |

### \_release

```solidity
function _release(struct RewardLib.Reward reward, uint256 amount, uint256 delegatedAmount) internal
```

function does multiple things:

- Unreserves future staking rewards to make them available for withdrawal;
- Expires the reward to stop rewards from accumulating;

### \_getDelegatedAmount

```solidity
function _getDelegatedAmount(uint256 amount, uint256 delegationRateDenominator) internal pure returns (uint256)
```

calculates an amount that community stakers have to delegate to operators

#### Parameters

| Name                      | Type    | Description                                              |
| ------------------------- | ------- | -------------------------------------------------------- |
| amount                    | uint256 | base staked amount to calculate delegated amount against |
| delegationRateDenominator | uint256 | Delegation rate used to calculate delegated stake amount |

### \_getNonDelegatedAmount

```solidity
function _getNonDelegatedAmount(uint256 amount, uint256 delegationRateDenominator) internal pure returns (uint256)
```

calculates the amount of stake that remains after accounting for delegation requirement

#### Parameters

| Name                      | Type    | Description                                                  |
| ------------------------- | ------- | ------------------------------------------------------------ |
| amount                    | uint256 | base staked amount to calculate non-delegated amount against |
| delegationRateDenominator | uint256 | Delegation rate used to calculate delegated stake amount     |

### \_getRemainingDuration

```solidity
function _getRemainingDuration(struct RewardLib.Reward reward) internal view returns (uint256)
```

#### Return Values

| Name | Type    | Description                                                                    |
| ---- | ------- | ------------------------------------------------------------------------------ |
| [0]  | uint256 | uint256 the remaining reward duration (time until end), or 0 if expired/ended. |

### \_updateDuration

```solidity
function _updateDuration(struct RewardLib.Reward reward, uint256 maxPoolSize, uint256 totalStakedAmount, uint256 newRate, uint256 minRewardDuration, uint256 availableReward, uint256 totalDelegatedAmount) internal
```

This function is called when the staking pool is initialized,
pool size is changed, reward rates are changed, rewards are added, and an alert is raised

#### Parameters

| Name                 | Type                    | Description                                                    |
| -------------------- | ----------------------- | -------------------------------------------------------------- |
| reward               | struct RewardLib.Reward |                                                                |
| maxPoolSize          | uint256                 | Current maximum staking pool size                              |
| totalStakedAmount    | uint256                 | Currently staked amount across community stakers and operators |
| newRate              | uint256                 | New reward rate if it needs to be changed                      |
| minRewardDuration    | uint256                 | The minimum duration rewards need to last for                  |
| availableReward      | uint256                 | available reward amount                                        |
| totalDelegatedAmount | uint256                 | total delegated amount delegated by community stakers          |

### \_getEarnedBaseRewards

```solidity
function _getEarnedBaseRewards(struct RewardLib.Reward reward, uint256 totalStakedAmount, uint256 totalDelegatedAmount) internal view returns (uint256)
```

#### Return Values

| Name | Type    | Description                                            |
| ---- | ------- | ------------------------------------------------------ |
| [0]  | uint256 | The total amount of base rewards earned by all stakers |

### \_getEarnedDelegationRewards

```solidity
function _getEarnedDelegationRewards(struct RewardLib.Reward reward, uint256 totalDelegatedAmount) internal view returns (uint256)
```

#### Return Values

| Name | Type    | Description                                                        |
| ---- | ------- | ------------------------------------------------------------------ |
| [0]  | uint256 | The total amount of delegated rewards earned by all node operators |

### \_slashOnFeedOperators

```solidity
function _slashOnFeedOperators(struct RewardLib.Reward reward, uint256 minOperatorStakeAmount, uint256 slashableDuration, address[] feedOperators, mapping(address => struct StakingPoolLib.Staker) stakers, uint256 totalDelegatedAmount) internal
```

Slashes all on feed node operators.
Node operators are slashed the minimum of either the
amount of rewards they have earned or the amount
of rewards earned by the minimum operator stake amount
over the slashable duration.

### \_getSlashableBaseRewards

```solidity
function _getSlashableBaseRewards(struct RewardLib.Reward reward, uint256 minOperatorStakeAmount, uint256 slashableDuration) private view returns (uint256)
```

The amount of rewards accrued over the slashable duration for a
minimum node operator stake amount

#### Return Values

| Name | Type    | Description                         |
| ---- | ------- | ----------------------------------- |
| [0]  | uint256 | The amount of base rewards to slash |

### \_getSlashableDelegatedRewards

```solidity
function _getSlashableDelegatedRewards(struct RewardLib.Reward reward, uint256 slashableDuration, uint256 totalDelegatedAmount) private view returns (uint256)
```

_The amount of delegated rewards accrued over the slashable duration_

#### Return Values

| Name | Type    | Description                              |
| ---- | ------- | ---------------------------------------- |
| [0]  | uint256 | The amount of delegated rewards to slash |

### \_slashOperatorBaseRewards

```solidity
function _slashOperatorBaseRewards(struct RewardLib.Reward reward, uint256 slashableRewards, address operator, uint256 operatorStakedAmount) private returns (uint256)
```

Slashes an on feed node operator the minimum of
either the total amount of base rewards they have
earned or the amount of rewards earned by the
minimum operator stake amount over the slashable duration.

### \_slashOperatorDelegatedRewards

```solidity
function _slashOperatorDelegatedRewards(struct RewardLib.Reward reward, uint256 slashableRewards, address operator, uint256 totalDelegatedAmount) private returns (uint256)
```

Slashes an on feed node operator the minimum of
either the total amount of delegated rewards they have
earned or the amount of delegated rewards they have
earned over the slashable duration.

### \_getOperatorEarnedBaseRewards

```solidity
function _getOperatorEarnedBaseRewards(struct RewardLib.Reward reward, address operator, uint256 operatorStakedAmount) internal view returns (uint256)
```

#### Return Values

| Name | Type    | Description                                        |
| ---- | ------- | -------------------------------------------------- |
| [0]  | uint256 | The amount of base rewards an operator has earned. |

### \_getOperatorEarnedDelegatedRewards

```solidity
function _getOperatorEarnedDelegatedRewards(struct RewardLib.Reward reward, address operator, uint256 totalDelegatedAmount) internal view returns (uint256)
```

#### Return Values

| Name | Type    | Description                                             |
| ---- | ------- | ------------------------------------------------------- |
| [0]  | uint256 | The amount of delegated rewards an operator has earned. |

### \_getCappedTimestamp

```solidity
function _getCappedTimestamp(struct RewardLib.Reward reward) internal view returns (uint256)
```

_This is necessary to ensure that rewards are calculated correctly
after the reward is depleted._

#### Return Values

| Name | Type    | Description                                                                                               |
| ---- | ------- | --------------------------------------------------------------------------------------------------------- |
| [0]  | uint256 | The current timestamp or, if the current timestamp has passed reward end timestamp, reward end timestamp. |

## SafeCast

### CastError

```solidity
error CastError()
```

### MAX_UINT_8

```solidity
uint256 MAX_UINT_8
```

This is used to safely case timestamps to uint8

### MAX_UINT_32

```solidity
uint256 MAX_UINT_32
```

This is used to safely case timestamps to uint32

### MAX_UINT_80

```solidity
uint256 MAX_UINT_80
```

This is used to safely case timestamps to uint80

### MAX_UINT_96

```solidity
uint256 MAX_UINT_96
```

This is used to safely case timestamps to uint96

### \_toUint8

```solidity
function _toUint8(uint256 value) internal pure returns (uint8)
```

### \_toUint32

```solidity
function _toUint32(uint256 value) internal pure returns (uint32)
```

### \_toUint80

```solidity
function _toUint80(uint256 value) internal pure returns (uint80)
```

### \_toUint96

```solidity
function _toUint96(uint256 value) internal pure returns (uint96)
```

## Staking

### PoolConstructorParams

```solidity
struct PoolConstructorParams {
  contract LinkTokenInterface LINKAddress;
  contract AggregatorV3Interface monitoredFeed;
  uint256 initialMaxPoolSize;
  uint256 initialMaxCommunityStakeAmount;
  uint256 initialMaxOperatorStakeAmount;
  uint256 minCommunityStakeAmount;
  uint256 minOperatorStakeAmount;
  uint256 priorityPeriodThreshold;
  uint256 regularPeriodThreshold;
  uint256 maxAlertingRewardAmount;
  uint256 minInitialOperatorCount;
  uint256 minRewardDuration;
  uint256 slashableDuration;
  uint256 delegationRateDenominator;
}
```

### ALERTING_REWARD_STAKED_AMOUNT_DENOMINATOR

```solidity
uint256 ALERTING_REWARD_STAKED_AMOUNT_DENOMINATOR
```

The amount to divide an alerter's stake amount when
calculating their reward for raising an alert.

### i_LINK

```solidity
contract LinkTokenInterface i_LINK
```

### s_pool

```solidity
struct StakingPoolLib.Pool s_pool
```

### s_reward

```solidity
struct RewardLib.Reward s_reward
```

### i_monitoredFeed

```solidity
contract AggregatorV3Interface i_monitoredFeed
```

The ETH USD feed that alerters can raise alerts for.

### s_proposedMigrationTarget

```solidity
address s_proposedMigrationTarget
```

The proposed address stakers will migrate funds to

### s_proposedMigrationTargetAt

```solidity
uint256 s_proposedMigrationTargetAt
```

The timestamp of when the migration target was proposed at

### s_migrationTarget

```solidity
address s_migrationTarget
```

The address stakers can migrate their funds to

### s_lastAlertedRoundId

```solidity
uint256 s_lastAlertedRoundId
```

The round ID of the last feed round an alert was raised

### s_merkleRoot

```solidity
bytes32 s_merkleRoot
```

The merkle root of the merkle tree generated from the list
of staker addresses with early acccess.

### i_priorityPeriodThreshold

```solidity
uint256 i_priorityPeriodThreshold
```

The number of seconds until the feed is considered stale
and the priority period begins.

### i_regularPeriodThreshold

```solidity
uint256 i_regularPeriodThreshold
```

The number of seconds until the priority period ends
and the regular period begins.

### i_maxAlertingRewardAmount

```solidity
uint256 i_maxAlertingRewardAmount
```

The amount of LINK to reward an operator who
raises an alert in the priority period.

### i_minOperatorStakeAmount

```solidity
uint256 i_minOperatorStakeAmount
```

The minimum stake amount that a node operator can stake

### i_minCommunityStakeAmount

```solidity
uint256 i_minCommunityStakeAmount
```

The minimum stake amount that a community staker can stake

### i_minInitialOperatorCount

```solidity
uint256 i_minInitialOperatorCount
```

The minimum number of node operators required to initialize the
staking pool.

### i_minRewardDuration

```solidity
uint256 i_minRewardDuration
```

The minimum reward duration after pool config updates and pool
reward extensions

### i_slashableDuration

```solidity
uint256 i_slashableDuration
```

The duration of earned rewards to slash when an alert is raised

### i_delegationRateDenominator

```solidity
uint256 i_delegationRateDenominator
```

Used to calculate delegated stake amount
= amount / delegation rate denominator = 100% / 100 = 1%

### constructor

```solidity
constructor(struct Staking.PoolConstructorParams params) public
```

### typeAndVersion

```solidity
function typeAndVersion() external pure returns (string)
```

### hasAccess

```solidity
function hasAccess(address staker, bytes32[] proof) external view returns (bool)
```

Validates if a community staker has access to the private staking pool

#### Parameters

| Name   | Type      | Description                                       |
| ------ | --------- | ------------------------------------------------- |
| staker | address   | The community staker's address                    |
| proof  | bytes32[] | Merkle proof for the community staker's allowlist |

### setMerkleRoot

```solidity
function setMerkleRoot(bytes32 newMerkleRoot) external
```

This function is called to update the staking allowlist in a private staking pool

_Only callable by the contract owner_

#### Parameters

| Name          | Type    | Description                                                                                                                                                                           |
| ------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| newMerkleRoot | bytes32 | Merkle Tree root, used to prove access for community stakers will be required at start but can be removed at any time by the owner when staking access will be granted to the public. |

### getMerkleRoot

```solidity
function getMerkleRoot() external view returns (bytes32)
```

#### Return Values

| Name | Type    | Description                                           |
| ---- | ------- | ----------------------------------------------------- |
| [0]  | bytes32 | The current root of the Staking allowlist merkle tree |

### setPoolConfig

```solidity
function setPoolConfig(uint256 maxPoolSize, uint256 maxCommunityStakeAmount, uint256 maxOperatorStakeAmount) external
```

Set the pool config

#### Parameters

| Name                    | Type    | Description                                         |
| ----------------------- | ------- | --------------------------------------------------- |
| maxPoolSize             | uint256 | The max amount of staked LINK allowed in the pool   |
| maxCommunityStakeAmount | uint256 | The max amount of LINK a community staker can stake |
| maxOperatorStakeAmount  | uint256 | The max amount of LINK a Node Op can stake          |

### setFeedOperators

```solidity
function setFeedOperators(address[] operators) external
```

Allows the contract owner to set the list of on-feed operator addresses who are subject to slashing

_Existing feed operators are cleared before setting the new operators._

#### Parameters

| Name      | Type      | Description                                   |
| --------- | --------- | --------------------------------------------- |
| operators | address[] | New list of on-feed operator staker addresses |

### start

```solidity
function start(uint256 amount, uint256 initialRewardRate) external
```

Transfers LINK tokens and initializes the reward

_Uses ERC20 approve + transferFrom flow_

#### Parameters

| Name              | Type    | Description                                                |
| ----------------- | ------- | ---------------------------------------------------------- |
| amount            | uint256 | rewards amount in LINK                                     |
| initialRewardRate | uint256 | The amount of LINK earned per second for each LINK staked. |

### conclude

```solidity
function conclude() external
```

Closes the pool, unreserving future staker rewards, expires the
reward and releases unreserved rewards

### addReward

```solidity
function addReward(uint256 amount) external
```

This function can be called to add rewards to the pool

_Should only be callable by the owner_

#### Parameters

| Name   | Type    | Description                              |
| ------ | ------- | ---------------------------------------- |
| amount | uint256 | The amount of rewards to add to the pool |

### withdrawUnusedReward

```solidity
function withdrawUnusedReward() external
```

This function can be called to withdraw unused reward amount from
the staking pool. It can be called before the pool is initialized, after
the pool is concluded or when the reward expires.

_Should only be callable by the owner when the pool is closed_

### addOperators

```solidity
function addOperators(address[] operators) external
```

Adds one or more operators to a list of operators

\_Required conditions for adding operators:

- Operators can only be added to the pool if they have no prior stake.
- Operators can only be readded to the pool if they have no removed
  stake.
- Operators cannot be added to the pool after staking ends (either through
  conclusion or through reward expiry).\_

#### Parameters

| Name      | Type      | Description                         |
| --------- | --------- | ----------------------------------- |
| operators | address[] | A list of operator addresses to add |

### removeOperators

```solidity
function removeOperators(address[] operators) external
```

Removes one or more operators from a list of operators. When an
operator is removed, we store their principal in a separate mapping to
prevent immediate withdrawals. This is so that the removed operator can
only unstake at the same time as every other staker.

_Should only be callable by the owner when the pool is open.
When an operator is removed they can stake as a community staker.
We allow that because the alternative (checking for removed stake before
staking) is going to unnecessarily increase gas costs in 99.99% of the
cases._

#### Parameters

| Name      | Type      | Description                            |
| --------- | --------- | -------------------------------------- |
| operators | address[] | A list of operator addresses to remove |

### changeRewardRate

```solidity
function changeRewardRate(uint256 newRate) external
```

This function can be called to change the reward rate for the pool.
This change only affects future rewards, i.e. rewards earned at a previous
rate are unaffected.

_Should only be callable by the owner. The rate can be increased or decreased.
The new rate cannot be 0._

#### Parameters

| Name    | Type    | Description |
| ------- | ------- | ----------- |
| newRate | uint256 |             |

### emergencyPause

```solidity
function emergencyPause() external
```

This function pauses staking

_Sets the pause flag to true_

### emergencyUnpause

```solidity
function emergencyUnpause() external
```

This function unpauses staking

_Sets the pause flag to false_

### getFeedOperators

```solidity
function getFeedOperators() external view returns (address[])
```

#### Return Values

| Name | Type      | Description                                                |
| ---- | --------- | ---------------------------------------------------------- |
| [0]  | address[] | List of the ETH-USD feed node operators' staking addresses |

### getMigrationTarget

```solidity
function getMigrationTarget() external view returns (address)
```

This function returns the migration target contract address

### proposeMigrationTarget

```solidity
function proposeMigrationTarget(address migrationTarget) external
```

This function allows the contract owner to set a proposed
migration target address. If the migration target is valid it renounces
the previously accepted migration target (if any).

#### Parameters

| Name            | Type    | Description                            |
| --------------- | ------- | -------------------------------------- |
| migrationTarget | address | Contract address to migrate stakes to. |

### acceptMigrationTarget

```solidity
function acceptMigrationTarget() external
```

This function allows the contract owner to accept a proposed migration target address after a waiting period.

### migrate

```solidity
function migrate(bytes data) external
```

This function allows stakers to migrate funds to a new staking pool.

#### Parameters

| Name | Type  | Description            |
| ---- | ----- | ---------------------- |
| data | bytes | Migration path details |

### raiseAlert

```solidity
function raiseAlert() external
```

This function creates an alert for a stalled feed

### canAlert

```solidity
function canAlert(address alerter) external view returns (bool)
```

This function checks to see whether the alerter may raise an alert
to claim rewards

### unstake

```solidity
function unstake() external
```

This function allows stakers to exit the pool after it has been
concluded. It returns the principal as well as base and delegation
rewards.

### withdrawRemovedStake

```solidity
function withdrawRemovedStake() external
```

This function allows removed operators to withdraw their original
principal. Operators can only withdraw after the pool is closed, like
every other staker.

### getStake

```solidity
function getStake(address staker) public view returns (uint256)
```

#### Parameters

| Name   | Type    | Description |
| ------ | ------- | ----------- |
| staker | address | address     |

#### Return Values

| Name | Type    | Description                              |
| ---- | ------- | ---------------------------------------- |
| [0]  | uint256 | uint256 staker's staked principal amount |

### isOperator

```solidity
function isOperator(address staker) external view returns (bool)
```

Returns true if an address is an operator

### isActive

```solidity
function isActive() public view returns (bool)
```

The staking pool starts closed and only allows
stakers to stake once it's opened

#### Return Values

| Name | Type | Description      |
| ---- | ---- | ---------------- |
| [0]  | bool | bool pool status |

### getMaxPoolSize

```solidity
function getMaxPoolSize() external view returns (uint256)
```

#### Return Values

| Name | Type    | Description                               |
| ---- | ------- | ----------------------------------------- |
| [0]  | uint256 | uint256 current maximum staking pool size |

### getCommunityStakerLimits

```solidity
function getCommunityStakerLimits() external view returns (uint256, uint256)
```

#### Return Values

| Name | Type    | Description                                                     |
| ---- | ------- | --------------------------------------------------------------- |
| [0]  | uint256 | uint256 minimum amount that can be staked by a community staker |
| [1]  | uint256 | uint256 maximum amount that can be staked by a community staker |

### getOperatorLimits

```solidity
function getOperatorLimits() external view returns (uint256, uint256)
```

#### Return Values

| Name | Type    | Description                                              |
| ---- | ------- | -------------------------------------------------------- |
| [0]  | uint256 | uint256 minimum amount that can be staked by an operator |
| [1]  | uint256 | uint256 maximum amount that can be staked by an operator |

### getRewardTimestamps

```solidity
function getRewardTimestamps() external view returns (uint256, uint256)
```

#### Return Values

| Name | Type    | Description                             |
| ---- | ------- | --------------------------------------- |
| [0]  | uint256 | uint256 reward initialization timestamp |
| [1]  | uint256 | uint256 reward expiry timestamp         |

### getRewardRate

```solidity
function getRewardRate() external view returns (uint256)
```

#### Return Values

| Name | Type    | Description                                                               |
| ---- | ------- | ------------------------------------------------------------------------- |
| [0]  | uint256 | uint256 current reward rate, expressed in juels per second per micro LINK |

### getDelegationRateDenominator

```solidity
function getDelegationRateDenominator() external view returns (uint256)
```

#### Return Values

| Name | Type    | Description                     |
| ---- | ------- | ------------------------------- |
| [0]  | uint256 | uint256 current delegation rate |

### getAvailableReward

```solidity
function getAvailableReward() public view returns (uint256)
```

_This reflects how many rewards were made available over the
lifetime of the staking pool. This is not updated when the rewards are
unstaked or migrated by the stakers. This means that the contract balance
will dip below available amount when the reward expires and users start
moving their rewards._

#### Return Values

| Name | Type    | Description                                                             |
| ---- | ------- | ----------------------------------------------------------------------- |
| [0]  | uint256 | uint256 total amount of LINK tokens made available for rewards in Juels |

### getBaseReward

```solidity
function getBaseReward(address staker) public view returns (uint256)
```

#### Return Values

| Name | Type    | Description                                                |
| ---- | ------- | ---------------------------------------------------------- |
| [0]  | uint256 | uint256 amount of base rewards earned by a staker in Juels |

### getDelegationReward

```solidity
function getDelegationReward(address staker) public view returns (uint256)
```

#### Return Values

| Name | Type    | Description                                                         |
| ---- | ------- | ------------------------------------------------------------------- |
| [0]  | uint256 | uint256 amount of delegation rewards earned by an operator in Juels |

### getTotalDelegatedAmount

```solidity
function getTotalDelegatedAmount() public view returns (uint256)
```

Total delegated amount is calculated by dividing the total
community staker staked amount by the delegation rate, i.e.
totalDelegatedAmount = pool.totalCommunityStakedAmount / delegationRateDenominator

#### Return Values

| Name | Type    | Description                                                                     |
| ---- | ------- | ------------------------------------------------------------------------------- |
| [0]  | uint256 | uint256 staked amount that is used when calculating delegation rewards in Juels |

### getDelegatesCount

```solidity
function getDelegatesCount() external view returns (uint256)
```

Delegates count increases after an operator is added to the list
of operators and stakes the minimum required amount.

#### Return Values

| Name | Type    | Description                                                                  |
| ---- | ------- | ---------------------------------------------------------------------------- |
| [0]  | uint256 | uint256 number of staking operators that are eligible for delegation rewards |

### getTotalStakedAmount

```solidity
function getTotalStakedAmount() external view returns (uint256)
```

#### Return Values

| Name | Type    | Description                                                             |
| ---- | ------- | ----------------------------------------------------------------------- |
| [0]  | uint256 | uint256 total amount staked by community stakers and operators in Juels |

### getTotalCommunityStakedAmount

```solidity
function getTotalCommunityStakedAmount() external view returns (uint256)
```

#### Return Values

| Name | Type    | Description                                               |
| ---- | ------- | --------------------------------------------------------- |
| [0]  | uint256 | uint256 total amount staked by community stakers in Juels |

### getTotalRemovedAmount

```solidity
function getTotalRemovedAmount() external view returns (uint256)
```

_Used to make sure that contract's balance is correct.
total staked amount + total removed amount + available rewards = current balance_

#### Return Values

| Name | Type    | Description                                                                                                 |
| ---- | ------- | ----------------------------------------------------------------------------------------------------------- |
| [0]  | uint256 | uint256 the sum of removed operator principals that have not been withdrawn from the staking pool in Juels. |

### getEarnedBaseRewards

```solidity
function getEarnedBaseRewards() external view returns (uint256)
```

#### Return Values

| Name | Type    | Description                                                         |
| ---- | ------- | ------------------------------------------------------------------- |
| [0]  | uint256 | uint256 total amount of base rewards earned by all stakers in Juels |

### getEarnedDelegationRewards

```solidity
function getEarnedDelegationRewards() external view returns (uint256)
```

#### Return Values

| Name | Type    | Description                                                                     |
| ---- | ------- | ------------------------------------------------------------------------------- |
| [0]  | uint256 | uint256 total amount of delegated rewards earned by all node operators in Juels |

### isPaused

```solidity
function isPaused() external view returns (bool)
```

This function returns the pause state

#### Return Values

| Name | Type | Description                            |
| ---- | ---- | -------------------------------------- |
| [0]  | bool | bool whether or not the pool is paused |

### getChainlinkToken

```solidity
function getChainlinkToken() public view returns (address)
```

#### Return Values

| Name | Type    | Description                                                    |
| ---- | ------- | -------------------------------------------------------------- |
| [0]  | address | address LINK token contract's address that is used by the pool |

### getMonitoredFeed

```solidity
function getMonitoredFeed() external view returns (address)
```

#### Return Values

| Name | Type    | Description                                                         |
| ---- | ------- | ------------------------------------------------------------------- |
| [0]  | address | address The address of the feed being monitored to raise alerts for |

### onTokenTransfer

```solidity
function onTokenTransfer(address sender, uint256 amount, bytes data) external
```

Called when LINK is sent to the contract via `transferAndCall`

#### Parameters

| Name   | Type    | Description                                                  |
| ------ | ------- | ------------------------------------------------------------ |
| sender | address | Address of the sender                                        |
| amount | uint256 | Amount of LINK sent (specified in wei)                       |
| data   | bytes   | Optional payload containing a Staking Allowlist Merkle proof |

### \_stakeAsCommunityStaker

```solidity
function _stakeAsCommunityStaker(address staker, uint256 amount) private
```

Helper function for when a community staker enters the pool

_When an operator is removed they can stake as a community staker.
We allow that because the alternative (checking for removed stake before
staking) is going to unnecessarily increase gas costs in 99.99% of the
cases._

#### Parameters

| Name   | Type    | Description                    |
| ------ | ------- | ------------------------------ |
| staker | address | The staker address             |
| amount | uint256 | The amount of principal staked |

### \_stakeAsOperator

```solidity
function _stakeAsOperator(address staker, uint256 amount) private
```

Helper function for when an operator enters the pool

_Function skips validating whether or not the operator stake
amount will cause the total stake amount to exceed the maximum pool size.
This is because the pool already reserves a fixed amount of space
for each operator meaning that an operator staking cannot cause the
total stake amount to exceed the maximum pool size. Each operator
receives a reserved stake amount equal to the maxOperatorStakeAmount.
This is done by deducting operatorCount \* maxOperatorStakeAmount from the
remaining pool space available for staking._

#### Parameters

| Name   | Type    | Description                    |
| ------ | ------- | ------------------------------ |
| staker | address | The staker address             |
| amount | uint256 | The amount of principal staked |

### \_exit

```solidity
function _exit(address staker) private returns (uint256, uint256, uint256)
```

Helper function when staker exits the pool

#### Parameters

| Name   | Type    | Description        |
| ------ | ------- | ------------------ |
| staker | address | The staker address |

### \_calculateAlertingRewardAmount

```solidity
function _calculateAlertingRewardAmount(uint256 stakedAmount, bool isInPriorityPeriod) private view returns (uint256)
```

Calculates the reward amount an alerter will receive for raising
a successful alert in the current alerting period.

#### Parameters

| Name               | Type    | Description                                    |
| ------------------ | ------- | ---------------------------------------------- |
| stakedAmount       | uint256 | Amount of LINK staked by the alerter           |
| isInPriorityPeriod | bool    | True if it is currently in the priority period |

#### Return Values

| Name | Type    | Description                                                   |
| ---- | ------- | ------------------------------------------------------------- |
| [0]  | uint256 | rewardAmount Amount of LINK rewards to be paid to the alerter |

### \_isActive

```solidity
function _isActive() private view
```

_Having a private function for the modifer saves on the contract size_

### whenActive

```solidity
modifier whenActive()
```

_Reverts if the staking pool is inactive (not open for staking or
expired)_

### whenInactive

```solidity
modifier whenInactive()
```

_Reverts if the staking pool is active (open for staking)_

### validateFromLINK

```solidity
modifier validateFromLINK()
```

_Reverts if not sent from the LINK token_

## StakingPoolLib

### PoolOpened

```solidity
event PoolOpened()
```

This event is emitted when the staking pool is opened for stakers

### PoolConcluded

```solidity
event PoolConcluded()
```

This event is emitted when the staking pool is concluded

### PoolSizeIncreased

```solidity
event PoolSizeIncreased(uint256 maxPoolSize)
```

This event is emitted when the staking pool's maximum size is
increased

#### Parameters

| Name        | Type    | Description               |
| ----------- | ------- | ------------------------- |
| maxPoolSize | uint256 | the new maximum pool size |

### MaxCommunityStakeAmountIncreased

```solidity
event MaxCommunityStakeAmountIncreased(uint256 maxStakeAmount)
```

#### Parameters

| Name           | Type    | Description                  |
| -------------- | ------- | ---------------------------- |
| maxStakeAmount | uint256 | the new maximum stake amount |

### MaxOperatorStakeAmountIncreased

```solidity
event MaxOperatorStakeAmountIncreased(uint256 maxStakeAmount)
```

This event is emitted when the maximum stake amount for node
operators is increased

#### Parameters

| Name           | Type    | Description                  |
| -------------- | ------- | ---------------------------- |
| maxStakeAmount | uint256 | the new maximum stake amount |

### OperatorAdded

```solidity
event OperatorAdded(address operator)
```

This event is emitted when an operator is added

#### Parameters

| Name     | Type    | Description                                                |
| -------- | ------- | ---------------------------------------------------------- |
| operator | address | address of the operator that was added to the staking pool |

### OperatorRemoved

```solidity
event OperatorRemoved(address operator, uint256 amount)
```

This event is emitted when an operator is removed

#### Parameters

| Name     | Type    | Description                                                              |
| -------- | ------- | ------------------------------------------------------------------------ |
| operator | address | address of the operator that was removed from the staking pool           |
| amount   | uint256 | principal amount that will be available for withdrawal when staking ends |

### FeedOperatorsSet

```solidity
event FeedOperatorsSet(address[] feedOperators)
```

This event is emitted when the contract owner sets the list
of feed operators subject to slashing

#### Parameters

| Name          | Type      | Description                                 |
| ------------- | --------- | ------------------------------------------- |
| feedOperators | address[] | new list of feed operator staking addresses |

### InvalidPoolStatus

```solidity
error InvalidPoolStatus(bool currentStatus, bool requiredStatus)
```

Surfaces the required pool status to perform an operation

#### Parameters

| Name           | Type | Description                                                                                       |
| -------------- | ---- | ------------------------------------------------------------------------------------------------- |
| currentStatus  | bool | current status of the pool (true if open / false if closed)                                       |
| requiredStatus | bool | required status of the pool to proceed (true if pool must be open / false if pool must be closed) |

### InvalidPoolSize

```solidity
error InvalidPoolSize(uint256 maxPoolSize)
```

This error is raised when attempting to decrease maximum pool size

#### Parameters

| Name        | Type    | Description                   |
| ----------- | ------- | ----------------------------- |
| maxPoolSize | uint256 | the current maximum pool size |

### InvalidMaxStakeAmount

```solidity
error InvalidMaxStakeAmount(uint256 maxStakeAmount)
```

This error is raised when attempting to decrease maximum stake amount
for community stakers or node operators

#### Parameters

| Name           | Type    | Description                      |
| -------------- | ------- | -------------------------------- |
| maxStakeAmount | uint256 | the current maximum stake amount |

### InsufficientRemainingPoolSpace

```solidity
error InsufficientRemainingPoolSpace(uint256 remainingPoolSize, uint256 requiredPoolSize)
```

This error is raised when attempting to add more node operators without
sufficient available pool space to reserve their allocations.

#### Parameters

| Name              | Type    | Description                                                |
| ----------------- | ------- | ---------------------------------------------------------- |
| remainingPoolSize | uint256 | the remaining pool space available to reserve              |
| requiredPoolSize  | uint256 | the required reserved pool space to add new node operators |

### InsufficientStakeAmount

```solidity
error InsufficientStakeAmount(uint256 requiredAmount)
```

#### Parameters

| Name           | Type    | Description                   |
| -------------- | ------- | ----------------------------- |
| requiredAmount | uint256 | minimum required stake amount |

### ExcessiveStakeAmount

```solidity
error ExcessiveStakeAmount(uint256 remainingAmount)
```

This error is raised when stakers attempt to stake past pool limits

#### Parameters

| Name            | Type    | Description                                                                                                                                  |
| --------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| remainingAmount | uint256 | maximum remaining amount that can be staked. This is the difference between the existing staked amount and the individual and global limits. |

### StakeNotFound

```solidity
error StakeNotFound(address staker)
```

This error is raised when stakers attempt to exit the pool

#### Parameters

| Name   | Type    | Description                                           |
| ------ | ------- | ----------------------------------------------------- |
| staker | address | address of the staker who attempted to withdraw funds |

### ExistingStakeFound

```solidity
error ExistingStakeFound(address staker)
```

This error is raised when addresses with existing stake is added as an operator

#### Parameters

| Name   | Type    | Description                                             |
| ------ | ------- | ------------------------------------------------------- |
| staker | address | address of the staker who is being added as an operator |

### OperatorAlreadyExists

```solidity
error OperatorAlreadyExists(address operator)
```

This error is raised when an address is duplicated in the supplied list of operators.
This can happen in addOperators and setFeedOperators functions.

#### Parameters

| Name     | Type    | Description             |
| -------- | ------- | ----------------------- |
| operator | address | address of the operator |

### OperatorIsAssignedToFeed

```solidity
error OperatorIsAssignedToFeed(address operator)
```

This error is thrown when the owner attempts to remove an on-feed operator.

_The owner must remove the operator from the on-feed list first._

### OperatorDoesNotExist

```solidity
error OperatorDoesNotExist(address operator)
```

This error is raised when removing an operator in removeOperators
and setFeedOperators

#### Parameters

| Name     | Type    | Description             |
| -------- | ------- | ----------------------- |
| operator | address | address of the operator |

### OperatorIsLocked

```solidity
error OperatorIsLocked(address operator)
```

This error is raised when operator has been removed from the pool
and is attempted to be readded

#### Parameters

| Name     | Type    | Description                    |
| -------- | ------- | ------------------------------ |
| operator | address | address of the locked operator |

### InadequateInitialOperatorsCount

```solidity
error InadequateInitialOperatorsCount(uint256 currentOperatorsCount, uint256 minInitialOperatorsCount)
```

This error is raised when attempting to start staking with less
than the minimum required node operators

#### Parameters

| Name                     | Type    | Description                                                                 |
| ------------------------ | ------- | --------------------------------------------------------------------------- |
| currentOperatorsCount    | uint256 | The current number of operators in the staking pool                         |
| minInitialOperatorsCount | uint256 | The minimum required number of operators in the staking pool before opening |

### PoolLimits

```solidity
struct PoolLimits {
  uint96 maxPoolSize;
  uint80 maxCommunityStakeAmount;
  uint80 maxOperatorStakeAmount;
}

```

### PoolState

```solidity
struct PoolState {
  bool isOpen;
  uint8 operatorsCount;
  uint96 totalCommunityStakedAmount;
  uint96 totalOperatorStakedAmount;
}

```

### Staker

```solidity
struct Staker {
  bool isOperator;
  bool isFeedOperator;
  uint96 stakedAmount;
  uint96 removedStakeAmount;
}

```

### Pool

```solidity
struct Pool {
  mapping(address => struct StakingPoolLib.Staker) stakers;
  address[] feedOperators;
  struct StakingPoolLib.PoolState state;
  struct StakingPoolLib.PoolLimits limits;
  uint256 totalOperatorRemovedAmount;
}
```

### \_setConfig

```solidity
function _setConfig(struct StakingPoolLib.Pool pool, uint256 maxPoolSize, uint256 maxCommunityStakeAmount, uint256 maxOperatorStakeAmount) internal
```

Sets staking pool parameters

#### Parameters

| Name                    | Type                       | Description                                        |
| ----------------------- | -------------------------- | -------------------------------------------------- |
| pool                    | struct StakingPoolLib.Pool |                                                    |
| maxPoolSize             | uint256                    | Maximum total stake amount across all stakers      |
| maxCommunityStakeAmount | uint256                    | Maximum stake amount for a single community staker |
| maxOperatorStakeAmount  | uint256                    | Maximum stake amount for a single node operator    |

### \_open

```solidity
function _open(struct StakingPoolLib.Pool pool, uint256 minInitialOperatorCount) internal
```

Opens the staking pool

### \_close

```solidity
function _close(struct StakingPoolLib.Pool pool) internal
```

Closes the staking pool

### \_isOperator

```solidity
function _isOperator(struct StakingPoolLib.Pool pool, address staker) internal view returns (bool)
```

Returns true if a supplied staker address is in the operators list

#### Parameters

| Name   | Type                       | Description         |
| ------ | -------------------------- | ------------------- |
| pool   | struct StakingPoolLib.Pool |                     |
| staker | address                    | Address of a staker |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0]  | bool | bool        |

### \_getTotalStakedAmount

```solidity
function _getTotalStakedAmount(struct StakingPoolLib.Pool pool) internal view returns (uint256)
```

Returns the sum of all principal staked in the pool

#### Return Values

| Name | Type    | Description       |
| ---- | ------- | ----------------- |
| [0]  | uint256 | totalStakedAmount |

### \_getRemainingPoolSpace

```solidity
function _getRemainingPoolSpace(struct StakingPoolLib.Pool pool) internal view returns (uint256)
```

Returns the amount of remaining space available in the pool for
community stakers. Community stakers can only stake up to this amount
even if they are within their individual limits.

#### Return Values

| Name | Type    | Description        |
| ---- | ------- | ------------------ |
| [0]  | uint256 | remainingPoolSpace |

### \_addOperators

```solidity
function _addOperators(struct StakingPoolLib.Pool pool, address[] operators) internal
```

\_Required conditions for adding operators:

- Operators can only been added to the pool if they have no prior stake.
- Operators can only been readded to the pool if they have no removed
  stake.
- Operators cannot be added to the pool after staking ends (either through
  conclusion or through reward expiry).\_

### \_setFeedOperators

```solidity
function _setFeedOperators(struct StakingPoolLib.Pool pool, address[] operators) internal
```

Helper function to set the list of on-feed Operator addresses

#### Parameters

| Name      | Type                       | Description                |
| --------- | -------------------------- | -------------------------- |
| pool      | struct StakingPoolLib.Pool |                            |
| operators | address[]                  | List of Operator addresses |

## IAlertsController

### AlertRaised

```solidity
event AlertRaised(address alerter, uint256 roundId, uint256 rewardAmount)
```

Emitted when a valid alert is raised for a feed round

#### Parameters

| Name         | Type    | Description                                           |
| ------------ | ------- | ----------------------------------------------------- |
| alerter      | address | The address of an alerter                             |
| roundId      | uint256 | The feed's round ID that an alert has been raised for |
| rewardAmount | uint256 | The amount of LINK rewarded to the alerter            |

### AlertAlreadyExists

```solidity
error AlertAlreadyExists(uint256 roundId)
```

This error is thrown when an alerter tries to raise an

#### Parameters

| Name    | Type    | Description                                                          |
| ------- | ------- | -------------------------------------------------------------------- |
| roundId | uint256 | The feed's round ID that the alerter is trying to raise an alert for |

### AlertInvalid

```solidity
error AlertInvalid()
```

This error is thrown when alerting conditions are not met and the
alert is invalid.

### raiseAlert

```solidity
function raiseAlert() external
```

This function creates an alert for a stalled feed

### canAlert

```solidity
function canAlert(address alerter) external view returns (bool)
```

This function checks to see whether the alerter may raise an alert
to claim rewards

## IMerkleAccessController

### MerkleRootChanged

```solidity
event MerkleRootChanged(bytes32 newMerkleRoot)
```

Emitted when the contract owner updates the staking allowlist

#### Parameters

| Name          | Type    | Description                                     |
| ------------- | ------- | ----------------------------------------------- |
| newMerkleRoot | bytes32 | The root of a new Staking allowlist merkle tree |

### hasAccess

```solidity
function hasAccess(address staker, bytes32[] proof) external view returns (bool)
```

Validates if a community staker has access to the private staking pool

#### Parameters

| Name   | Type      | Description                                       |
| ------ | --------- | ------------------------------------------------- |
| staker | address   | The community staker's address                    |
| proof  | bytes32[] | Merkle proof for the community staker's allowlist |

### setMerkleRoot

```solidity
function setMerkleRoot(bytes32 newMerkleRoot) external
```

This function is called to update the staking allowlist in a private staking pool

_Only callable by the contract owner_

#### Parameters

| Name          | Type    | Description                                                                                                                                                                           |
| ------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| newMerkleRoot | bytes32 | Merkle Tree root, used to prove access for community stakers will be required at start but can be removed at any time by the owner when staking access will be granted to the public. |

### getMerkleRoot

```solidity
function getMerkleRoot() external view returns (bytes32)
```

#### Return Values

| Name | Type    | Description                                           |
| ---- | ------- | ----------------------------------------------------- |
| [0]  | bytes32 | The current root of the Staking allowlist merkle tree |

## IMigratable

### MigrationTargetProposed

```solidity
event MigrationTargetProposed(address migrationTarget)
```

This event is emitted when a migration target is proposed by the contract owner.

#### Parameters

| Name            | Type    | Description                            |
| --------------- | ------- | -------------------------------------- |
| migrationTarget | address | Contract address to migrate stakes to. |

### MigrationTargetAccepted

```solidity
event MigrationTargetAccepted(address migrationTarget)
```

This event is emitted after a 7 day period has passed since a migration target is proposed, and the target is accepted.

#### Parameters

| Name            | Type    | Description                            |
| --------------- | ------- | -------------------------------------- |
| migrationTarget | address | Contract address to migrate stakes to. |

### Migrated

```solidity
event Migrated(address staker, uint256 principal, uint256 baseReward, uint256 delegationReward, bytes data)
```

This event is emitted when a staker migrates their stake to the migration target.

#### Parameters

| Name             | Type    | Description                                            |
| ---------------- | ------- | ------------------------------------------------------ |
| staker           | address | Staker address                                         |
| principal        | uint256 | Principal amount deposited                             |
| baseReward       | uint256 | Amount of base rewards withdrawn                       |
| delegationReward | uint256 | Amount of delegation rewards withdrawn (if applicable) |
| data             | bytes   | Migration payload                                      |

### InvalidMigrationTarget

```solidity
error InvalidMigrationTarget()
```

This error is raised when the contract owner supplies a non-contract migration target.

### getMigrationTarget

```solidity
function getMigrationTarget() external view returns (address)
```

This function returns the migration target contract address

### proposeMigrationTarget

```solidity
function proposeMigrationTarget(address migrationTarget) external
```

This function allows the contract owner to set a proposed
migration target address. If the migration target is valid it renounces
the previously accepted migration target (if any).

#### Parameters

| Name            | Type    | Description                            |
| --------------- | ------- | -------------------------------------- |
| migrationTarget | address | Contract address to migrate stakes to. |

### acceptMigrationTarget

```solidity
function acceptMigrationTarget() external
```

This function allows the contract owner to accept a proposed migration target address after a waiting period.

### migrate

```solidity
function migrate(bytes data) external
```

This function allows stakers to migrate funds to a new staking pool.

#### Parameters

| Name | Type  | Description            |
| ---- | ----- | ---------------------- |
| data | bytes | Migration path details |

## IStaking

### Staked

```solidity
event Staked(address staker, uint256 newStake, uint256 totalStake)
```

This event is emitted when a staker adds stake to the pool.

#### Parameters

| Name       | Type    | Description                   |
| ---------- | ------- | ----------------------------- |
| staker     | address | Staker address                |
| newStake   | uint256 | New principal amount staked   |
| totalStake | uint256 | Total principal amount staked |

### Unstaked

```solidity
event Unstaked(address staker, uint256 principal, uint256 baseReward, uint256 delegationReward)
```

This event is emitted when a staker exits the pool.

#### Parameters

| Name             | Type    | Description                      |
| ---------------- | ------- | -------------------------------- |
| staker           | address | Staker address                   |
| principal        | uint256 | Principal amount staked          |
| baseReward       | uint256 | base reward earned               |
| delegationReward | uint256 | delegation reward earned, if any |

### SenderNotLinkToken

```solidity
error SenderNotLinkToken()
```

This error is thrown whenever the sender is not the LINK token

### AccessForbidden

```solidity
error AccessForbidden()
```

This error is thrown whenever an address does not have access
to successfully execute a transaction

### InvalidZeroAddress

```solidity
error InvalidZeroAddress()
```

This error is thrown whenever a zero-address is supplied when
a non-zero address is required

### unstake

```solidity
function unstake() external
```

This function allows stakers to exit the pool after it has been
concluded. It returns the principal as well as base and delegation
rewards.

### withdrawRemovedStake

```solidity
function withdrawRemovedStake() external
```

This function allows removed operators to withdraw their original
principal. Operators can only withdraw after the pool is closed, like
every other staker.

### getChainlinkToken

```solidity
function getChainlinkToken() external view returns (address)
```

#### Return Values

| Name | Type    | Description                                                    |
| ---- | ------- | -------------------------------------------------------------- |
| [0]  | address | address LINK token contract's address that is used by the pool |

### getStake

```solidity
function getStake(address staker) external view returns (uint256)
```

#### Parameters

| Name   | Type    | Description |
| ------ | ------- | ----------- |
| staker | address | address     |

#### Return Values

| Name | Type    | Description                              |
| ---- | ------- | ---------------------------------------- |
| [0]  | uint256 | uint256 staker's staked principal amount |

### isOperator

```solidity
function isOperator(address staker) external view returns (bool)
```

Returns true if an address is an operator

### isActive

```solidity
function isActive() external view returns (bool)
```

The staking pool starts closed and only allows
stakers to stake once it's opened

#### Return Values

| Name | Type | Description      |
| ---- | ---- | ---------------- |
| [0]  | bool | bool pool status |

### getMaxPoolSize

```solidity
function getMaxPoolSize() external view returns (uint256)
```

#### Return Values

| Name | Type    | Description                               |
| ---- | ------- | ----------------------------------------- |
| [0]  | uint256 | uint256 current maximum staking pool size |

### getCommunityStakerLimits

```solidity
function getCommunityStakerLimits() external view returns (uint256, uint256)
```

#### Return Values

| Name | Type    | Description                                                     |
| ---- | ------- | --------------------------------------------------------------- |
| [0]  | uint256 | uint256 minimum amount that can be staked by a community staker |
| [1]  | uint256 | uint256 maximum amount that can be staked by a community staker |

### getOperatorLimits

```solidity
function getOperatorLimits() external view returns (uint256, uint256)
```

#### Return Values

| Name | Type    | Description                                              |
| ---- | ------- | -------------------------------------------------------- |
| [0]  | uint256 | uint256 minimum amount that can be staked by an operator |
| [1]  | uint256 | uint256 maximum amount that can be staked by an operator |

### getRewardTimestamps

```solidity
function getRewardTimestamps() external view returns (uint256, uint256)
```

#### Return Values

| Name | Type    | Description                             |
| ---- | ------- | --------------------------------------- |
| [0]  | uint256 | uint256 reward initialization timestamp |
| [1]  | uint256 | uint256 reward expiry timestamp         |

### getRewardRate

```solidity
function getRewardRate() external view returns (uint256)
```

#### Return Values

| Name | Type    | Description                                                               |
| ---- | ------- | ------------------------------------------------------------------------- |
| [0]  | uint256 | uint256 current reward rate, expressed in juels per second per micro LINK |

### getDelegationRateDenominator

```solidity
function getDelegationRateDenominator() external view returns (uint256)
```

#### Return Values

| Name | Type    | Description                     |
| ---- | ------- | ------------------------------- |
| [0]  | uint256 | uint256 current delegation rate |

### getAvailableReward

```solidity
function getAvailableReward() external view returns (uint256)
```

_This reflects how many rewards were made available over the
lifetime of the staking pool. This is not updated when the rewards are
unstaked or migrated by the stakers. This means that the contract balance
will dip below available amount when the reward expires and users start
moving their rewards._

#### Return Values

| Name | Type    | Description                                                             |
| ---- | ------- | ----------------------------------------------------------------------- |
| [0]  | uint256 | uint256 total amount of LINK tokens made available for rewards in Juels |

### getBaseReward

```solidity
function getBaseReward(address) external view returns (uint256)
```

#### Return Values

| Name | Type    | Description                                                |
| ---- | ------- | ---------------------------------------------------------- |
| [0]  | uint256 | uint256 amount of base rewards earned by a staker in Juels |

### getDelegationReward

```solidity
function getDelegationReward(address) external view returns (uint256)
```

#### Return Values

| Name | Type    | Description                                                         |
| ---- | ------- | ------------------------------------------------------------------- |
| [0]  | uint256 | uint256 amount of delegation rewards earned by an operator in Juels |

### getTotalDelegatedAmount

```solidity
function getTotalDelegatedAmount() external view returns (uint256)
```

Total delegated amount is calculated by dividing the total
community staker staked amount by the delegation rate, i.e.
totalDelegatedAmount = pool.totalCommunityStakedAmount / delegationRateDenominator

#### Return Values

| Name | Type    | Description                                                                     |
| ---- | ------- | ------------------------------------------------------------------------------- |
| [0]  | uint256 | uint256 staked amount that is used when calculating delegation rewards in Juels |

### getDelegatesCount

```solidity
function getDelegatesCount() external view returns (uint256)
```

Delegates count increases after an operator is added to the list
of operators and stakes the minimum required amount.

#### Return Values

| Name | Type    | Description                                                                  |
| ---- | ------- | ---------------------------------------------------------------------------- |
| [0]  | uint256 | uint256 number of staking operators that are eligible for delegation rewards |

### getEarnedBaseRewards

```solidity
function getEarnedBaseRewards() external view returns (uint256)
```

#### Return Values

| Name | Type    | Description                                                         |
| ---- | ------- | ------------------------------------------------------------------- |
| [0]  | uint256 | uint256 total amount of base rewards earned by all stakers in Juels |

### getEarnedDelegationRewards

```solidity
function getEarnedDelegationRewards() external view returns (uint256)
```

#### Return Values

| Name | Type    | Description                                                                     |
| ---- | ------- | ------------------------------------------------------------------------------- |
| [0]  | uint256 | uint256 total amount of delegated rewards earned by all node operators in Juels |

### getTotalStakedAmount

```solidity
function getTotalStakedAmount() external view returns (uint256)
```

#### Return Values

| Name | Type    | Description                                                             |
| ---- | ------- | ----------------------------------------------------------------------- |
| [0]  | uint256 | uint256 total amount staked by community stakers and operators in Juels |

### getTotalCommunityStakedAmount

```solidity
function getTotalCommunityStakedAmount() external view returns (uint256)
```

#### Return Values

| Name | Type    | Description                                               |
| ---- | ------- | --------------------------------------------------------- |
| [0]  | uint256 | uint256 total amount staked by community stakers in Juels |

### getTotalRemovedAmount

```solidity
function getTotalRemovedAmount() external view returns (uint256)
```

_Used to make sure that contract's balance is correct.
total staked amount + total removed amount + available rewards = current balance_

#### Return Values

| Name | Type    | Description                                                                                                 |
| ---- | ------- | ----------------------------------------------------------------------------------------------------------- |
| [0]  | uint256 | uint256 the sum of removed operator principals that have not been withdrawn from the staking pool in Juels. |

### isPaused

```solidity
function isPaused() external view returns (bool)
```

This function returns the pause state

#### Return Values

| Name | Type | Description                            |
| ---- | ---- | -------------------------------------- |
| [0]  | bool | bool whether or not the pool is paused |

### getMonitoredFeed

```solidity
function getMonitoredFeed() external view returns (address)
```

#### Return Values

| Name | Type    | Description                                                         |
| ---- | ------- | ------------------------------------------------------------------- |
| [0]  | address | address The address of the feed being monitored to raise alerts for |

## IStakingOwner

Owner functions restricted to the setup and maintenance
of the staking contract by the owner.

### InvalidDelegationRate

```solidity
error InvalidDelegationRate()
```

This error is thrown when an zero delegation rate is supplied

### InvalidRegularPeriodThreshold

```solidity
error InvalidRegularPeriodThreshold()
```

This error is thrown when an invalid regular period threshold is supplied

### InvalidMinOperatorStakeAmount

```solidity
error InvalidMinOperatorStakeAmount()
```

This error is thrown when an invalid min operator stake amount is
supplied

### InvalidMinCommunityStakeAmount

```solidity
error InvalidMinCommunityStakeAmount()
```

This error is thrown when an invalid min community stake amount
is supplied

### InvalidMaxAlertingRewardAmount

```solidity
error InvalidMaxAlertingRewardAmount()
```

This error is thrown when an invalid max alerting reward is
supplied

### MerkleRootNotSet

```solidity
error MerkleRootNotSet()
```

This error is thrown when the pool is started with an empty
merkle root

### addOperators

```solidity
function addOperators(address[] operators) external
```

Adds one or more operators to a list of operators

_Should only callable by the Owner_

#### Parameters

| Name      | Type      | Description                         |
| --------- | --------- | ----------------------------------- |
| operators | address[] | A list of operator addresses to add |

### removeOperators

```solidity
function removeOperators(address[] operators) external
```

Removes one or more operators from a list of operators. When an
operator is removed, we store their principal in a separate mapping to
prevent immediate withdrawals. This is so that the removed operator can
only unstake at the same time as every other staker.

_Should only be callable by the owner when the pool is open.
When an operator is removed they can stake as a community staker.
We allow that because the alternative (checking for removed stake before
staking) is going to unnecessarily increase gas costs in 99.99% of the
cases._

#### Parameters

| Name      | Type      | Description                            |
| --------- | --------- | -------------------------------------- |
| operators | address[] | A list of operator addresses to remove |

### setFeedOperators

```solidity
function setFeedOperators(address[] operators) external
```

Allows the contract owner to set the list of on-feed operator addresses who are subject to slashing

_Existing feed operators are cleared before setting the new operators._

#### Parameters

| Name      | Type      | Description                                   |
| --------- | --------- | --------------------------------------------- |
| operators | address[] | New list of on-feed operator staker addresses |

### getFeedOperators

```solidity
function getFeedOperators() external view returns (address[])
```

#### Return Values

| Name | Type      | Description                                                |
| ---- | --------- | ---------------------------------------------------------- |
| [0]  | address[] | List of the ETH-USD feed node operators' staking addresses |

### changeRewardRate

```solidity
function changeRewardRate(uint256 rate) external
```

This function can be called to change the reward rate for the pool.
This change only affects future rewards, i.e. rewards earned at a previous
rate are unaffected.

_Should only be callable by the owner. The rate can be increased or decreased.
The new rate cannot be 0._

#### Parameters

| Name | Type    | Description         |
| ---- | ------- | ------------------- |
| rate | uint256 | The new reward rate |

### addReward

```solidity
function addReward(uint256 amount) external
```

This function can be called to add rewards to the pool

_Should only be callable by the owner_

#### Parameters

| Name   | Type    | Description                              |
| ------ | ------- | ---------------------------------------- |
| amount | uint256 | The amount of rewards to add to the pool |

### withdrawUnusedReward

```solidity
function withdrawUnusedReward() external
```

This function can be called to withdraw unused reward amount from
the staking pool. It can be called before the pool is initialized, after
the pool is concluded or when the reward expires.

_Should only be callable by the owner when the pool is closed_

### setPoolConfig

```solidity
function setPoolConfig(uint256 maxPoolSize, uint256 maxCommunityStakeAmount, uint256 maxOperatorStakeAmount) external
```

Set the pool config

#### Parameters

| Name                    | Type    | Description                                         |
| ----------------------- | ------- | --------------------------------------------------- |
| maxPoolSize             | uint256 | The max amount of staked LINK allowed in the pool   |
| maxCommunityStakeAmount | uint256 | The max amount of LINK a community staker can stake |
| maxOperatorStakeAmount  | uint256 | The max amount of LINK a Node Op can stake          |

### start

```solidity
function start(uint256 amount, uint256 initialRewardRate) external
```

Transfers LINK tokens and initializes the reward

_Uses ERC20 approve + transferFrom flow_

#### Parameters

| Name              | Type    | Description                                                |
| ----------------- | ------- | ---------------------------------------------------------- |
| amount            | uint256 | rewards amount in LINK                                     |
| initialRewardRate | uint256 | The amount of LINK earned per second for each LINK staked. |

### conclude

```solidity
function conclude() external
```

Closes the pool, unreserving future staker rewards, expires the
reward and releases unreserved rewards

### emergencyPause

```solidity
function emergencyPause() external
```

This function pauses staking

_Sets the pause flag to true_

### emergencyUnpause

```solidity
function emergencyUnpause() external
```

This function unpauses staking

_Sets the pause flag to false_
