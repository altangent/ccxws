const { testClient } = require("../test-runner");
const BinanceClient = require("../../src/exchanges/binance-client");

testClient({
  clientFactory: () => new BinanceClient(),
  clientName: "BinanceClient",
  exchangeName: "Binance",
  markets: [
    {
      id: "BTCUSDT",
      base: "BTC",
      quote: "USDT",
    },
  ],

  hasTickers: true,
  hasTrades: true,
  hasLevel2Snapshots: true,
  hasLevel2Updates: true,
  hasLevel3Snapshots: false,
  hasLevel3Updates: false,

  ticker: {
    hasTimestamp: true,
    hasLast: true,
    hasOpen: true,
    hasHigh: true,
    hasLow: true,
    hasVolume: true,
    hasQuoteVolume: true,
    hasChange: true,
    hasChangePercent: true,
    hasBid: true,
    hasBidVolume: true,
    hasAsk: true,
    hasAskVolume: true,
  },

  trade: {
    hasTradeId: true,
  },

  l2snapshot: {
    hasTimestampMs: false,
    hasSequenceId: true,
    hasCount: false,
  },

  l2update: {
    hasSnapshot: true,
    hasTimestampMs: false,
    hasSequenceId: true,
    hasCount: false,
  },
});
