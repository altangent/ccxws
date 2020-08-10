const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const { BinanceBase } = require("./binance-base");

class BinanceFuturesCoinmClient extends BinanceBase {
  constructor({
    useAggTrades = true,
    requestSnapshot = true,
    socketBatchSize = 200,
    socketThrottleMs = 1000,
    restThrottleMs = 1000,
    l2snapshotSpeed = "100ms",
    l2updateSpeed = "100ms",
  } = {}) {
    super({
      name: "Binance Futures COIN-M",
      wssPath: "wss://dstream.binance.com/stream",
      restL2SnapshotPath: "https://dapi.binance.com/dapi/v1/depth",
      useAggTrades,
      requestSnapshot,
      socketBatchSize,
      socketThrottleMs,
      restThrottleMs,
      l2snapshotSpeed,
      l2updateSpeed,
    });
  }

  /**
   * Custom construction for a partial depth update. This deviates from
   * the spot market by including the `pu` property where updates may
   * not be sequential. The update message looks like:
    {
      "e": "depthUpdate",           // Event type
      "E": 1591270260907,           // Event time
      "T": 1591270260891,           // Transction time
      "s": "BTCUSD_200626",         // Symbol
      "ps": "BTCUSD",               // Pair
      "U": 17285681,                // First update ID in event
      "u": 17285702,                // Final update ID in event
      "pu": 17285675,               // Final update Id in last stream(ie `u` in last stream)
      "b": [                        // Bids to be updated
        [
          "9517.6",                 // Price level to be updated
          "10"                      // Quantity
        ]
      ],
      "a": [                        // Asks to be updated
        [
          "9518.5",                 // Price level to be updated
          "45"                      // Quantity
        ]
      ]
    }
   */
  _constructLevel2Update(msg, market) {
    let timestampsMs = msg.data.T;
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
      timestampsMs,
      asks,
      bids,
    });
  }

  /**
   * Partial book snapshot that. This deviates from the spot market by
   * including a previous last update id, `pu`.
      {
        "e":"depthUpdate",        // Event type
        "E":1591269996801,        // Event time
        "T":1591269996646,        // Transaction time
        "s":"BTCUSD_200626",      // Symbol
        "ps":"BTCUSD",            // Pair
        "U":17276694,
        "u":17276701,
        "pu":17276678,
        "b":[                     // Bids to be updated
          [
            "9523.0",             // Price Level
            "5"                   // Quantity
          ],
          [
            "9522.8",
            "8"
          ]
        ],
        "a":[                     // Asks to be updated
          [
            "9524.6",             // Price level to be
            "2"                   // Quantity
          ],
          [
            "9524.7",
            "3"
          ]
        ]
      }

   * @param {*} msg
   * @param {*} market
   */
  _constructLevel2Snapshot(msg, market) {
    let timestampsMs = msg.data.E;
    let sequenceId = msg.data.U;
    let lastSequenceId = msg.data.u;
    let previousLastSequenceId = msg.data.pu;
    let asks = msg.data.a.map(p => new Level2Point(p[0], p[1]));
    let bids = msg.data.a.map(p => new Level2Point(p[0], p[1]));
    return new Level2Snapshot({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      sequenceId,
      lastSequenceId,
      previousLastSequenceId,
      timestampsMs,
      asks,
      bids,
    });
  }
}

module.exports = BinanceFuturesCoinmClient;
