pragma solidity ^0.4.24;

import {LinkToken} from '@chainlink/contracts/src/v0.4/LinkToken.sol';

contract MockLinkToken is LinkToken {
  /// @notice dummy function to test case where transfer fails
  function transfer(
    address, /**_to**/
    uint256 /**_value**/
  ) public returns (bool success) {
    return false;
  }

  /// @notice dummy function to test case where transferFrom fails
  function transferFrom(
    address, /**_from**/
    address, /**_to**/
    uint256 /**_value**/
  ) public returns (bool success) {
    return false;
  }

  /// @notice dummy function to test case where transferAndCall fails
  function transferAndCall(
    address, /**_to*/
    uint256, /**_value */
    bytes /**_data */
  ) public returns (bool success) {
    return false;
  }
}
