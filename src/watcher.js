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

    this.markAlive = this.markAlive.bind(this);
    client.on("ticker", this.markAlive);
    client.on("candle", this.markAlive);
    client.on("trade", this.markAlive);
    client.on("l2snapshot", this.markAlive);
    client.on("l2update", this.markAlive);
    client.on("l3snapshot", this.markAlive);
    client.on("l3update", this.markAlive);
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
  markAlive() {
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
    this.client.reconnect();
    this.stop();
  }
}

module.exports = Watcher;
