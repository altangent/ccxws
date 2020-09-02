const { Strategy } = require('./abstract-strategy');
const { ClientWithCounter } = require('../../client-with-counter');

/**
 * FillHolesStrategy find the first client that doesn't reach threshold.
 */
class FillHolesStrategy extends Strategy {
  constructor(...args) {
    super(...args);
    this._clients = [];
    this._map = Object.create(null);
  }

  /**
   * Creates client from factory and wrap it by subscription counter.
   */
  _createClient() {
    const client = new ClientWithCounter(this._clientFactory(...this._options.clientArgs));
    client.once('closed', () => {
      // Remove clients
      const idx = this._clients.findIndex(x => x === client);
      this._clients.splice(idx, 1);
    });
    return client;
  }

  _findHole() {
    return this._clients.find(x => x.getCounter() !== this._options.maxSubscriptions);
  }

  take(id) {
    if (this._map[id]) {
      return this._map[id];
    }
    let client = this._findHole();
    if (!client) {
      client = this._createClient();
      this._clients.push(client);
    }
    this._map[id] = client;
    return client;
  }

  leave(id) {
    const client = this._map[id];
    delete this._map[id];
    return client;
  }
}

module.exports = {
  FillHolesStrategy,
};
