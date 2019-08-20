class Level3Update {
  constructor(props) {
    for (let key in props) {
      this[key] = props[key];
    }
  }

  /**
   * @deprecated use Market object (second argument to each event) to determine exchange and trade pair
   */
  get fullId() {
    return `${this.exchange}:${this.base}/${this.quote}`;
  }
}

module.exports = Level3Update;
