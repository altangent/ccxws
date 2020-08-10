const KrakenOrderBookPoint = require("./KrakenOrderBookPoint");

// eslint-disable-next-line no-unused-vars
const Level2Update = require("../level2-update");

/**
 * Implementation of the Liquid Order Book that pulls information
 * from the Liquid Web Socket feed defined here:
 * https://developers.liquid.com/#public-channels
 *
 * Liquid does not provide timestamps or sequence identifiers with their
 * order book stream. The stream acts as a psuedo snapshot stream in
 * that each "update" message is actually the top 40 items in one side
 * of the book (ask or bid). Therefore, the update processing simply
 * replaces one side of the book.
 *
 * # Example
 *
 * ```javascript
 * const client = new ccxws.liquid();
 * const market = { id: "btceur", base: "BTC", quote: "EUR" };
 * const ob = new LiquidOrderBook();
 *
 * client.subscribeLevel2Updates(market);
 * client.on("l2update", update => {
 *   ob.update(update);
 * });
 * ```
 */
class LiquidOrderBook {
  constructor(asks = [], bids = []) {
    this.asks = asks;
    this.bids = bids;
  }

  /**
   * The update will contain 40 new points for either the ask or bid
   * side. The update replaces the appropriate side of the book with
   * the new values.
   * @param {Level2Update} update
   */
  update({ asks, bids }) {
    const now = Date.now();
    if (asks.length) {
      this.asks = asks.map(p => new KrakenOrderBookPoint(p.price, p.size, now));
    }

    if (bids.length) {
      this.bids = bids.map(p => new KrakenOrderBookPoint(p.price, p.size, now));
    }
  }

  /**
   * Obtains a snapshot of the best asks and bids according to requested
   * depth.
   * @param {number} depth
   */
  snapshot(depth = 10) {
    return {
      asks: this.asks.slice(0, depth),
      bids: this.bids.slice(0, depth),
    };
  }
}

module.exports = LiquidOrderBook;
