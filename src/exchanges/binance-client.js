const { BinanceBase } = require("./binance-base");

class BinanceClient extends BinanceBase {
  constructor({
    useAggTrades = true,
    requestSnapshot = true,
    socketBatchSize = 200,
    socketThrottleMs = 1000,
    restThrottleMs = 1000,
    testNet = false,
    watcherMs,
    l2updateSpeed,
    l2snapshotSpeed,
  } = {}) {
    let wssPath = "wss://stream.binance.com:9443/stream";
    let apiPath = "https://api.binance.com/api";
    if (testNet) {
      wssPath = "wss://testnet.binance.vision/stream";
      apiPath = "https://testnet.binance.vision/api"
    }

    super({
      name: "Binance",
      restL2SnapshotPath: `${apiPath}/v1/depth`,
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
