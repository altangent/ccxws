class Trade {
  constructor({
    exchange,
    base,
    quote,
    tradeId,
    unix,
    side,
    price,
    amount,
    buyOrderId,
    sellOrderId,
  }) {
    this.exchange = exchange;
    this.quote = quote;
    this.base = base;
    this.tradeId = tradeId;
    this.unix = unix;
    this.side = side;
    this.price = price;
    this.amount = amount;
    this.buyOrderId = buyOrderId;
    this.sellOrderId = sellOrderId;
  }

  get marketId() {
    return `${this.base}/${this.quote}`;
  }

  get fullId() {
    return `${this.exchange}:${this.base}/${this.quote}`;
  }
}

module.exports = Trade;
