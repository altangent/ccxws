class Level2Snapshot {
  constructor(props) {
    for (let key in props) {
      this[key] = props[key];
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

module.exports = Level2Snapshot;
