class Ticker {
  constructor({
    exchange,
    base,
    quote,
    timestamp,
    sequenceId,
    last,
    open,
    high,
    low,
    volume,
    quoteVolume,
    change,
    changePercent,
    bid,
    bidVolume,
    ask,
    askVolume,
  }) {
    this.exchange = exchange;
    this.base = base;
    this.quote = quote;
    this.timestamp = timestamp;
    this.sequenceId = sequenceId;
    this.last = last;
    this.open = open;
    this.high = high;
    this.low = low;
    this.volume = volume;
    this.quoteVolume = quoteVolume;
    this.change = change;
    this.changePercent = changePercent;
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

module.exports = Ticker;
