const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const { BinanceBase } = require("./binance-base");

class BinanceFuturesUsdtMClient extends BinanceBase {
  constructor({
    useAggTrades = true,
    requestSnapshot = true,
    socketBatchSize = 200,
    socketThrottleMs = 1000,
    restThrottleMs = 1000,
    l2snapshotSpeed = "100ms",
    l2updateSpeed = "0ms",
    watcherMs,
  } = {}) {
    super({
      name: "Binance Futures USDT-M",
      wssPath: "wss://fstream.binance.com/stream",
      restL2SnapshotPath: "https://fapi.binance.com/fapi/v1/depth",
      useAggTrades,
      requestSnapshot,
      socketBatchSize,
      socketThrottleMs,
      restThrottleMs,
      l2snapshotSpeed,
      l2updateSpeed,
      watcherMs,
    });
  }

  /**
   * Custom construction for a partial depth update. This deviates from
   * the spot market by including the `pu` property where updates may
   * not be sequential. The update message looks like:
   * {
      "e": "depthUpdate", // Event type
      "E": 123456789,     // Event time
      "T": 123456788,     // transaction time
      "s": "BTCUSDT",      // Symbol
      "U": 157,           // First update ID in event
      "u": 160,           // Final update ID in event
      "pu": 149,          // Final update Id in last stream(ie `u` in last stream)
      "b": [              // Bids to be updated
        [
          "0.0024",       // Price level to be updated
          "10"            // Quantity
        ]
      ],
      "a": [              // Asks to be updated
        [
          "0.0026",       // Price level to be updated
          "100"          // Quantity
        ]
      ]
    }
   */
  _constructLevel2Update(msg, market) {
    let timestampMs = msg.data.T;
    let sequenceId = msg.data.U;
    let lastSequenceId = msg.data.u;
    let previousLastSequenceId = msg.data.pu;
    let asks = msg.data.a.map(p => new Level2Point(p[0], p[1]));
    let bids = msg.data.b.map(p => new Level2Point(p[0], p[1]));
    return new Level2Snapshot({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      sequenceId,
      lastSequenceId,
      previousLastSequenceId,
      timestampMs,
      asks,
      bids,
    });
  }

  /**
   * Partial book snapshot that. This deviates from the spot market by
   * including a previous last update id, `pu`.
      {
        "e": "depthUpdate", // Event type
        "E": 1571889248277, // Event time
        "T": 1571889248276, // transaction time
        "s": "BTCUSDT",
        "U": 390497796,
        "u": 390497878,
        "pu": 390497794,
        "b": [          // Bids to be updated
          [
            "7403.89",  // Price Level to be
            "0.002"     // Quantity
          ],
          [
            "7403.90",
            "3.906"
          ]
        ],
        "a": [          // Asks to be updated
          [
            "7405.96",  // Price level to be
            "3.340"     // Quantity
          ],
          [
            "7406.63",
            "4.525"
          ]
        ]
      }
   * @param {*} msg
   * @param {*} market
   */
  _constructLevel2Snapshot(msg, market) {
    let timestampMs = msg.data.E;
    let sequenceId = msg.data.U;
    let lastSequenceId = msg.data.u;
    let previousLastSequenceId = msg.data.pu;
    let asks = msg.data.a.map(p => new Level2Point(p[0], p[1]));
    let bids = msg.data.b.map(p => new Level2Point(p[0], p[1]));
    return new Level2Snapshot({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      sequenceId,
      lastSequenceId,
      previousLastSequenceId,
      timestampMs,
      asks,
      bids,
    });
  }
}

module.exports = BinanceFuturesUsdtMClient;
