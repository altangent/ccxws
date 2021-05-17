const { BinanceBase } = require("./binance-base");

class BinanceClient extends BinanceBase {
  constructor({
    useAggTrades = true,
    requestSnapshot = true,
    socketBatchSize = 200,
    socketThrottleMs = 1000,
    restThrottleMs = 1000,
    testNet = false,
    wssPath = "wss://stream.binance.com:9443/stream",
    restL2SnapshotPath = "https://api.binance.com/api/v1/depth",
    watcherMs,
    l2updateSpeed,
    l2snapshotSpeed,
  } = {}) {
    if (testNet) {
      wssPath = "wss://testnet.binance.vision/stream";
      apiPath = "https://testnet.binance.vision/api/v1/depth"
    }
    super({
      name: "Binance",
      restL2SnapshotPath,
      wssPath,
      useAggTrades,
      requestSnapshot,
      socketBatchSize,
      socketThrottleMs,
      restThrottleMs,
      watcherMs,
      l2updateSpeed,
      l2snapshotSpeed,
    });
  }
}

module.exports = BinanceClient;
