const { L3Point } = require("./L3Point");
const KrakenOrderBookPoint = require("./KrakenOrderBookPoint");

/**
 * Maintains a Level 3 order book for LedgerX
 */
class LedgerXOrderBook {
  constructor(snap) {
    this.asks = new Map();
    this.bids = new Map();
    this.sequenceId = snap.sequenceId;
    this.runId = 0;

    for (let ask of snap.asks) {
      this.asks.set(ask.orderId, new L3Point(ask.orderId, Number(ask.price), Number(ask.size)));
    }

    for (let bid of snap.bids) {
      this.bids.set(bid.orderId, new L3Point(bid.orderId, Number(bid.price), Number(bid.size)));
    }
  }

  reset() {
    this.sequenceId = 0;
    this.asks.clear();
    this.bids.clear();
  }

  /**
   *
   * @param {L3Point} updatea
   */
  update(update) {
    this.sequenceId += 1;

    // Capature the runId of the first update
    if (this.runId === 0) {
      this.runId = update.runId;
    }
    // Handle when the run_id changes and we need to reset things
    else if (update.runId > this.runId) {
      this.reset();
    }

    // Handle if we have odd data for some reason
    if (update.asks.length > 1 || update.bids.length > 1) {
      throw new Error("Malformed update", update);
    }

    // Extract the update
    let isAsk = update.asks.length > 0;

    let value = isAsk ? update.asks[0] : update.bids[0];
    let map = isAsk ? this.asks : this.bids;

    let orderId = value.orderId;
    let price = Number(value.price);
    let size = Number(value.size);
    let timestamp = value.timestamp;

    // Handle deleting the point
    if (size === 0) {
      map.delete(orderId);
      return;
    }

    // Next try to obtain the point

    // Update existing point
    if (map.has(orderId)) {
      let point = map.get(orderId);
      point.price = price;
      point.size = size;
      point.timestamp = timestamp;
    }

    // Insert the new point
    else {
      map.set(orderId, new L3Point(orderId, price, size, timestamp));
    }
  }

  /**
   * Captures a price aggregated snapshot
   * @param {number} depth
   */
  snapshot(depth = 10) {
    return {
      sequenceId: this.sequenceId,
      runId: this.runId,
      asks: snapSide(this.asks, sortAsc, depth),
      bids: snapSide(this.bids, sortDesc, depth),
    };
  }
}

function snapSide(map, sorter, depth) {
  const aggMap = aggByPrice(map);
  return Array.from(aggMap.values())
    .sort(sorter)
    .slice(0, depth);
}

function aggByPrice(map) {
  // Aggregate the values into price points
  const aggMap = new Map();
  for (const point of map.values()) {
    const price = Number(point.price);
    const size = Number(point.size);

    // If we don't have this price point in the aggregate then we create
    // a new price point with empty values.
    if (!aggMap.has(price)) {
      aggMap.set(price, new KrakenOrderBookPoint(price, 0, 0));
    }

    // Obtain the price point from the aggregation
    const aggPoint = aggMap.get(price);

    // Update the size
    aggPoint.size += size;
  }

  return aggMap;
}

function sortAsc(a, b) {
  return a.price - b.price;
}

function sortDesc(a, b) {
  return b.price - a.price;
}

module.exports = LedgerXOrderBook;
