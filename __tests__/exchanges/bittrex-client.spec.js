const { testClient } = require("../test-runner");
const BittrexClient = require("../../src/exchanges/bittrex-client");
const https = require("../../src/https");

testClient({
  clientFactory: () => new BittrexClient(),
  clientName: "BittrexClient",
  exchangeName: "Bittrex",
  markets: [
    {
      id: "BTC-USDT",
      base: "BTC",
      quote: "USDT",
    },
    {
      id: "ETH-BTC",
      base: "ETH",
      quote: "BTC",
    },
    {
      id: "LTC-BTC",
      base: "LTC",
      quote: "BTC",
    },
    {
      id: "XRP-BTC",
      base: "XRP",
      quote: "BTC",
    },
  ],

  async fetchAllMarkets() {
    let res = await https.get("https://api.bittrex.com/v3/markets");
    return res.map(p => ({
      id: p.symbol,
      base: p.baseCurrencySymbol,
      quote: p.quoteCurrencySymbol,
    }));
  },

  testConnectEvents: false,
  testDisconnectEvents: false,
  testReconnectionEvents: false,
  testCloseEvents: false,

  testAllMarketsTrades: true,
  testAllMarketsTradesSuccess: 30,

  hasTickers: true,
  hasTrades: true,
  hasCandles: true,
  hasLevel2Snapshots: false,
  hasLevel2Updates: true,
  hasLevel3Snapshots: false,
  hasLevel3Updates: false,

  ticker: {
    hasTimestamp: true,
    hasLast: false,
    hasOpen: false,
    hasHigh: true,
    hasLow: true,
    hasVolume: true,
    hasQuoteVolume: true,
    hasChange: false,
    hasChangePercent: true,
    hasBid: false,
    hasBidVolume: false,
    hasAsk: false,
    hasAskVolume: false,
  },

  trade: {
    hasTradeId: true,
  },

  l2snapshot: {
    hasTimestampMs: false,
    hasSequenceId: false,
    hasCount: false,
  },

  l2update: {
    hasSnapshot: true,
    hasTimestampMs: false,
    hasSequenceId: true,
    hasCount: false,
  },
});
