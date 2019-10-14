const { testClient } = require("../test-runner");
const ZBClient = require("../../src/exchanges/zb-client");

testClient({
  clientFactory: () => new ZBClient(),
  clientName: "ZBClient",
  exchangeName: "ZB",
  markets: [
    {
      id: "btc_usdt",
      base: "BTC",
      quote: "USDT",
    },
  ],

  testConnectEvents: true,
  testDisconnectEvents: true,
  testReconnectionEvents: true,
  testCloseEvents: true,

  hasTickers: true,
  hasTrades: true,
  hasCandles: false,
  hasLevel2Snapshots: true,
  hasLevel2Updates: false,
  hasLevel3Snapshots: false,
  hasLevel3Updates: false,

  ticker: {
    hasTimestamp: true,
    hasLast: true,
    hasOpen: false,
    hasHigh: true,
    hasLow: true,
    hasVolume: true,
    hasQuoteVolume: false,
    hasChange: false,
    hasChangePercent: false,
    hasAsk: true,
    hasBid: true,
    hasAskVolume: false,
    hasBidVolume: false,
  },

  trade: {
    hasTradeId: true,
    tradeIdPattern: /[0-9]+/,
  },

  l2snapshot: {
    hasTimestampMs: true,
    hasSequenceId: false,
    hasCount: false,
  },
});
