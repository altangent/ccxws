const { testClient } = require("../test-runner");
const LiquidClient = require("../../src/exchanges/liquid-client");

testClient({
  clientFactory: () => new LiquidClient(),
  clientName: "LiquidClient",
  exchangeName: "Liquid",
  markets: [
    {
      id: "btcjpy",
      base: "BTC",
      quote: "JPY",
    },
  ],

  testConnectEvents: true,
  testDisconnectEvents: true,
  testReconnectionEvents: true,
  testCloseEvents: true,

  hasTickers: true,
  hasTrades: true,
  hasCandles: false,
  hasLevel2Snapshots: false,
  hasLevel2Updates: false,
  hasLevel3Snapshots: false,
  hasLevel3Updates: false,

  ticker: {
    hasTimestamp: true,
    hasLast: true,
    hasOpen: true,
    hasHigh: false,
    hasLow: false,
    hasVolume: true,
    hasQuoteVolume: false,
    hasChange: true,
    hasChangePercent: true,
    hasAsk: true,
    hasBid: true,
    hasAskVolume: false,
    hasBidVolume: false,
  },

  trade: {
    hasTradeId: true,
  },

  // l2snapshot: {
  //   hasTimestampMs: true,
  //   hasSequenceId: false,
  //   hasCount: true,
  // },

  // l2update: {
  //   hasSnapshot: true,
  //   hasTimestampMs: true,
  //   hasSequenceId: false,
  //   hasCount: true,
  // },
});
