const { L3Point } = require("./L3Point");
const L2Point = require("./KrakenOrderBookPoint");

/**
 * Prototype for maintaining a Level 3 order book for Kucoin according
 * to the instructions defined here:
 * https://docs.kucoin.com/#full-matchengine-data-level-3
 *
 * This technique uses a Map to store orders. It has efficient updates
 * but will be slow for performing tip of book or snapshot operations.
 *
 * # Example
 * ```javascript
 * const ccxws = require("ccxws");
 * const KucoinOrderBook = require("ccxws/src/orderbooks/KucoinOrderBook");
 *
 * let market = { id: "BTC-USDT", base: "BTC", quote: "USDT" };
 * let updates = [];
 * let ob;
 *
 * const client = new ccxws.Kucoin();
 * client.subscribeLevel3Updates(market);
 * client.on("l3snapshot", snapshot => {
 *   ob = new KucoinOrderBook(snapshot, updates);
 * });
 *
 * client.on("l3update", update => {
 *   // enqueue updates until snapshot arrives
 *   if (!ob) {
 *     updates.push(update);
 *     return;
 *   }
 *
 *   // validate the sequence and exit if we are out of sync
 *   if (ob.sequenceId + 1 !== update.sequenceId) {
 *     console.log(`out of sync, expected ${ob.sequenceId + 1}, got ${update.sequenceId}`);
 *     process.exit(1);
 *   }
 *
 *   // apply update
 *   ob.update(update);
 * });
 * ```
 */
class KucoinOrderBook {
  /**
   * Constructs a new order book by starting with a snapshop and replaying
   * any updates that have been queued.
   * @param {*} snap
   * @param {*} updates
   */
  constructor(snap, updates) {
    this.asks = new Map();
    this.bids = new Map();
    this.sequenceId = snap.sequenceId;

    // Verify that we have queued updates
    if (!updates.length || snap.sequenceId >= updates[updates.length - 1].sequenceId) {
      throw new Error("Must queue updates prior to snapshot");
    }

    // apply asks from snapshot
    for (let ask of snap.asks) {
      this.asks.set(
        ask.orderId,
        new L3Point(ask.orderId, Number(ask.price), Number(ask.size), Number(ask.meta.timestampMs))
      );
    }

    // apply bids from snapshot
    for (let bid of snap.bids) {
      this.bids.set(
        bid.orderId,
        new L3Point(bid.orderId, Number(bid.price), Number(bid.size), Number(bid.meta.timestampMs))
      );
    }

    // Replay pending updates
    for (const update of updates) {
      // Ignore updates that are prior to the snapshot
      if (update.sequenceId <= this.sequenceId) continue;

      // Ensure that we are in sync
      if (update.sequenceId > this.sequenceId + 1) {
        throw new Error("Missing update");
      }

      this.update(update);
    }
  }

  /**
   *
   * @param {L3Point} updatea
   */
  update(update) {
    // Always update the sequence
    this.sequenceId = update.sequenceId;

    // find the point in the update
    let updatePoint = update.asks[0] || update.bids[0];

    // Skip received orders
    if (updatePoint.meta.type === "received") return;

    // Open - insert a new point in the appropriate side (ask, bid).
    // When receiving a message with price="", size="0",
    // it means this is a hidden order and we can ignore it.
    if (updatePoint.meta.type === "open") {
      let map = update.asks[0] ? this.asks : this.bids;

      // Ignore private orders
      if (!Number(updatePoint.price) && !Number(updatePoint.size)) {
        return;
      }

      let obPoint = new L3Point(
        updatePoint.orderId,
        Number(updatePoint.price),
        Number(updatePoint.size),
        update.timestampMs
      );

      map.set(obPoint.orderId, obPoint);
      return;
    }

    // Done - remove the order, this won't include the side, so we
    // remove it from both side.
    if (updatePoint.meta.type === "done") {
      this.asks.delete(updatePoint.orderId);
      this.bids.delete(updatePoint.orderId);
      return;
    }

    // Change - modify the amount for the order. Update will be in both
    // the asks and bids since the update message doesn't include a
    // side. Change messages are sent when an order changes in size.
    // This includes resting orders (open) as well as recieved but not
    // yet open. In the latter case, no point will exist on the book
    // yet.
    if (updatePoint.meta.type === "update") {
      let obPoint = this.asks.get(updatePoint.orderId) || this.bids.get(updatePoint.orderId);
      if (obPoint) obPoint.size = Number(updatePoint.size);
      return;
    }

    // Trade - reduce the size of the maker to the remain size. We ignore
    // any updates if the remainSize is zero, since the done event may
    // have already removed the trae
    if (updatePoint.meta.type === "match") {
      let obPoint = this.asks.get(updatePoint.orderId) || this.bids.get(updatePoint.orderId);
      if (obPoint) obPoint.size = Number(updatePoint.size);
      return;
    }
  }

  /**
   * Captures a price aggregated snapshot
   * @param {number} depth
   */
  snapshot(depth = 10) {
    return {
      sequenceId: this.sequenceId,
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
    const price = point.price;
    const size = point.size;
    const timestamp = point.timestamp;

    // If we don't have this price point in the aggregate then we create
    // a new price point with empty values.
    if (!aggMap.has(price)) {
      aggMap.set(price, new L2Point(price, 0, 0));
    }

    // Obtain the price point from the aggregation
    const aggPoint = aggMap.get(price);

    // Update the size
    aggPoint.size += size;

    // Update the timestamp
    if (aggPoint.timestamp < timestamp) aggPoint.timestamp = timestamp;
  }

  return aggMap;
}

function sortAsc(a, b) {
  return a.price - b.price;
}

function sortDesc(a, b) {
  return b.price - a.price;
}

module.exports = KucoinOrderBook;
