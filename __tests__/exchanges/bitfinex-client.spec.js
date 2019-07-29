const { testClient } = require("../test-runner");
const BitfinexClient = require("../../src/exchanges/bitfinex-client");

testClient({
  clientFactory: () => new BitfinexClient(),
  clientName: "BitfinexClient",
  exchangeName: "Bitfinex",
  markets: [
    {
      id: "BTCUSD",
      base: "BTC",
      quote: "USDT",
    },
  ],

  hasTickers: true,
  hasTrades: true,
  hasLevel2Snapshots: false,
  hasLevel2Updates: true,
  hasLevel3Snapshots: false,
  hasLevel3Updates: true,

  ticker: {
    hasTimestamp: true,
    hasLast: true,
    hasOpen: true,
    hasHigh: true,
    hasLow: true,
    hasVolume: true,
    hasQuoteVolume: false,
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
    hasSequenceId: false,
    hasCount: true,
  },

  l2update: {
    hasSnapshot: true,
    hasTimestampMs: false,
    hasSequenceId: false,
    hasCount: true,
  },

  l3snapshot: {
    hasTimestampMs: false,
    hasSequenceId: false,
    hasCount: true,
  },

  l3update: {
    hasSnapshot: true,
    hasTimestampMs: false,
    hasSequenceId: false,
    hasCount: true,
  },
});
