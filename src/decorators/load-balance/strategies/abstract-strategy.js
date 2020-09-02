class Strategy {
  constructor(options) {
    this._options = options;
    this._clientFactory = options.clientFactory;
  }

  take() {
    throw new Error('not implemented');
  }

  leave() {
    throw new Error('not implemented');
  }
}

module.exports = {
  Strategy,
};
