/**
 *    {
 *    "u":400900217,     // order book updateId
 *    "s":"BNBUSDT",     // symbol
 *    "b":"25.35190000", // best bid price
 *    "B":"31.21000000", // best bid qty
 *    "a":"25.36520000", // best ask price
 *    "A":"40.66000000"  // best ask qty
 *  }
 *
 * @class BookTicker
 */
class BookTicker {
  constructor({
    exchange,
    base,
    quote,
    bid,
    bidVolume,
    ask,
    askVolume,
  }) {
    this.exchange = exchange;
    this.base = base;
    this.quote = quote;
    this.timestamp = timestamp;
    this.bid = bid;
    this.bidVolume = bidVolume;
    this.ask = ask;
    this.askVolume = askVolume;
  }

  /**
   * @deprecated use Market object (second argument to each event) to determine exchange and trade pair
   */
  get fullId() {
    return `${this.exchange}:${this.base}/${this.quote}`;
  }
}

module.exports = BookTicker;
