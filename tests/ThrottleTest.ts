import Throttle from "../src/Throttle.js";

function testThrottle() {
  const throttle = new Throttle(10, 1000);

  let executedCount = 0;
  const incrementExecutedCount = () => console.log(++executedCount);

  // Send 15 packets immediately
  for (let i = 0; i < 9; i++) {
    throttle.send(incrementExecutedCount);
  }
  // Send 15 packets immediately
  for (let i = 0; i < 2; i++) {
    throttle.send(incrementExecutedCount);
  }
}

testThrottle();
