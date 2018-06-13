class Level3Snapshot {
  constructor(props) {
    for (let key in props) {
      this[key] = props[key];
    }
  }

  get fullId() {
    return `${this.exchange}:${this.base}/${this.quote}`;
  }
}

module.exports = Level3Snapshot;
