class Level2Update {
  constructor(props) {
    for (let key in props) {
      this[key] = props[key];
    }
  }

  get marketId() {
    return `${this.base}/${this.quote}`;
  }

  get fullId() {
    return `${this.exchange}:${this.base}/${this.quote}`;
  }
}

module.exports = Level2Update;
