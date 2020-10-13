const { L3Point } = require("./L3Point");
const { L3PointStore } = require("./L3PointStore");

/**
 * Maintains a Level 3 order book for ErisX
 */
class ErisXOrderBook {
  constructor(snap) {
    this.asks = new L3PointStore();
    this.bids = new L3PointStore();
    this.timestampMs = snap.timestampMs;
    this.runId = 0;

    for (let ask of snap.asks) {
      this.asks.set(new L3Point(ask.orderId, Number(ask.price), Number(ask.size)));
    }

    for (let bid of snap.bids) {
      this.bids.set(new L3Point(bid.orderId, Number(bid.price), Number(bid.size)));
    }
  }

  update(update) {
    this.timestampMs = update.timestampMs;

    for (let point of update.asks) {
      this.updatePoint(point, false);
    }

    for (let point of update.bids) {
      this.updatePoint(point, false);
    }
  }

  updatePoint(point, isAsk) {
    let map = isAsk ? this.asks : this.bids;

    let orderId = point.orderId;
    let price = Number(point.price);
    let size = Number(point.size);
    let type = point.meta.type;

    if (type === "DELETE") {
      map.delete(orderId);
      return;
    } else if (type === "NEW") {
      map.set(new L3Point(orderId, price, size));
    } else {
      throw new Error("Unknown type");
    }
  }

  snapshot(depth = 10) {
    return {
      sequenceId: this.sequenceId,
      runId: this.runId,
      asks: this.asks.snapshot(depth, "asc"),
      bids: this.bids.snapshot(depth, "desc"),
    };
  }
}

module.exports = ErisXOrderBook;
