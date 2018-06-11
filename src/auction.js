class Auction {
  constructor({ exchange, base, quote, tradeId, unix, price, amount, high, low }) {
    this.exchange = exchange;
    this.quote = quote;
    this.base = base;
    this.tradeId = tradeId;
    this.unix = unix;
    this.price = price;
    this.high = high;
    this.low = low;
    this.amount = amount;
  }

  get marketId() {
    return `${this.base}/${this.quote}`;
  }

  get fullId() {
    return `${this.exchange}:${this.base}/${this.quote}`;
  }
}

module.exports = Auction;
