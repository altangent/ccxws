const winston = require("winston");

/**
 * Watcher subscribes to a client's messages and
 * will trigger a restart of the client if no
 * information has been transmitted in the checking interval
 */
class Watcher {
  constructor(client, intervalMs = 90000) {
    this.intervalMs = intervalMs;
    this.client = client;

    this._intervalHandle = undefined;
    this._lastMessage = undefined;

    this._markAlive = this._markAlive.bind(this);
    client.on("ticker", this._markAlive);
    client.on("trade", this._markAlive);
    client.on("l2snapshot", this._markAlive);
    client.on("l2update", this._markAlive);
    client.on("l3snapshot", this._markAlive);
    client.on("l3update", this._markAlive);
  }

  /**
   * Starts an interval to check if a reconnction is required
   */
  start() {
    this.stop(); // always clear the prior interval
    this._intervalHandle = setInterval(this._onCheck.bind(this), this.intervalMs);
  }

  /**
   * Stops an interval to check if a reconnection is required
   */
  stop() {
    clearInterval(this._intervalHandle);
    this._intervalHandle = undefined;
  }

  /**
   * Marks that a message was received
   */
  _markAlive() {
    this._lastMessage = Date.now();
  }

  /**
   * Checks if a reconnecton is required by comparing the current
   * date to the last receieved message date
   */
  _onCheck() {
    if (!this._lastMessage || this._lastMessage < Date.now() - this.intervalMs) {
      this._reconnect();
    }
  }

  /**
   * Logic to perform a reconnection event of the client
   */
  _reconnect() {
    winston.info("watcher initiating reconnection");
    this.client.reconnect();
    this.stop();
  }
}

module.exports = Watcher;
