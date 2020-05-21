const { BinanceBase } = require("./binance-base");

class BinanceJeClient extends BinanceBase {
  constructor({
    useAggTrades = true,
    requestSnapshot = true,
    socketBatchSize = 200,
    socketThrottleMs = 1000,
    restThrottleMs = 1000,
  } = {}) {
    super({
      name: "BinanceJe",
      wssPath: "wss://stream.binance.je:9443/stream",
      restL2SnapshotPath: "https://api.binance.je/api/v1/depth",
      useAggTrades,
      requestSnapshot,
      socketBatchSize,
      socketThrottleMs,
      restThrottleMs,
    });
  }
}

module.exports = BinanceJeClient;
