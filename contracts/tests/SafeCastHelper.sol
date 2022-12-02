// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {SafeCast} from '../SafeCast.sol';

contract SafeCastHelper {
  using SafeCast for uint256;

  function toUint8(uint256 value) external pure returns (uint8) {
    return value._toUint8();
  }

  function toUint32(uint256 value) external pure returns (uint32) {
    return value._toUint32();
  }

  function toUint80(uint256 value) external pure returns (uint80) {
    return value._toUint80();
  }

  function toUint96(uint256 value) external pure returns (uint96) {
    return value._toUint96();
  }
}
