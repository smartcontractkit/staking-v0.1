pragma solidity 0.8.16;

import 'forge-std/Test.sol';

contract Safe {
  receive() external payable {}

  function withdraw() external {
    payable(msg.sender).transfer(address(this).balance);
  }
}

contract SafeTest is Test {
  Safe internal s_safe;

  // Needed so the test contract itself can receive ether
  // when withdrawing
  receive() external payable {}

  function setUp() public {
    s_safe = new Safe();
    uint256 balance = address(this).balance;
    payable(address(s_safe)).transfer(balance);
    assertEq(balance, address(s_safe).balance);
  }

  function testWithdraw(uint256 amount) public {
    uint256 safeBalanceBefore = address(s_safe).balance;
    // vm.assume sets an assumption on the fuzz variable
    vm.assume(amount <= safeBalanceBefore);
    uint256 thisBalanceBefore = address(this).balance;

    assertEq(0, address(this).balance);

    s_safe.withdraw();

    uint256 safeBalanceAfter = address(s_safe).balance;
    uint256 thisBalanceAfter = address(this).balance;

    assertEq(thisBalanceBefore, safeBalanceAfter);
    assertEq(safeBalanceBefore, thisBalanceAfter);
  }
}
