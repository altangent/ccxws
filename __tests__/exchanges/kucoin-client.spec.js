const { testClient } = require("../test-runner");
const KucoinClient = require("../../src/exchanges/kucoin-client");

testClient({
  clientFactory: () => new KucoinClient(),
  clientName: "KucoinClient",
  exchangeName: "KuCoin",
  markets: [
    {
      id: "BTC-USDT",
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
  hasCandles: true,
  hasLevel2Snapshots: false,
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
    tradeIdPattern: /\w{24,}/,
  },

  candle: {},

  l2snapshot: {
    hasTimestampMs: false,
    hasSequenceId: true,
    hasCount: false,
  },

  l2update: {
    hasSnapshot: true,
    hasTimestampMs: false,
    hasSequenceId: true,
    hasLastSequenceId: true,
    hasCount: false,
  },
});
