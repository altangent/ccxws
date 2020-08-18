const { BinanceBase } = require("./binance-base");

class BinanceUSClient extends BinanceBase {
  constructor({
    useAggTrades = true,
    requestSnapshot = true,
    socketBatchSize = 200,
    socketThrottleMs = 1000,
    restThrottleMs = 1000,
    watcherMs,
  } = {}) {
    super({
      name: "BinanceUS",
      wssPath: "wss://stream.binance.us:9443/stream",
      restL2SnapshotPath: "https://api.binance.us/api/v1/depth",
      useAggTrades,
      requestSnapshot,
      socketBatchSize,
      socketThrottleMs,
      restThrottleMs,
      watcherMs,
    });
  }
}

module.exports = BinanceUSClient;
