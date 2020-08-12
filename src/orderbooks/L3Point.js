/**
 * Level 3 order book point
 */
class L3Point {
  constructor(orderId, price, size, timestamp) {
    this.orderId = orderId;
    this.price = price;
    this.size = size;
    this.timestamp = timestamp;
  }
}

module.exports.L3Point = L3Point;
