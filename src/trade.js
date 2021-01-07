class Trade {
  constructor(props) {
    this.exchange = props.exchange;
    this.quote = props.quote;
    this.base = props.base;
    this.tradeId = props.tradeId;
    this.unix = props.unix;
    this.side = props.side;
    this.price = props.price;
    this.amount = props.amount;
    this.buyOrderId = props.buyOrderId;
    this.sellOrderId = props.sellOrderId;
    this.sequenceId = props.sequenceId;
    // attach any extra props
    for (let key in props) {
      if (!this[key]) this[key] = props[key];
    }
  }

  get marketId() {
    return `${this.base}/${this.quote}`;
  }

  /**
   * @deprecated use Market object (second argument to each event) to determine exchange and trade pair
   */
  get fullId() {
    return `${this.exchange}:${this.base}/${this.quote}`;
  }
}

module.exports = Trade;
