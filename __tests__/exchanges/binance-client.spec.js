const { testClient } = require("../test-runner");
const BinanceClient = require("../../src/exchanges/binance-client");
const { get } = require("../../src/https");

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
    {
      id: "BTCUSDC",
      base: "BTC",
      quote: "USDC",
    },
  ],

  async fetchAllMarkets() {
    const results = await get("https://api.binance.com/api/v1/exchangeInfo");
    return results.symbols
      .filter(p => p.status === "TRADING")
      .map(p => ({ id: p.symbol, base: p.baseAsset, quote: p.quoteAsset }));
  },

  unsubWaitMs: 1500,

  testConnectEvents: true,
  testDisconnectEvents: true,
  testReconnectionEvents: true,
  testCloseEvents: true,

  testAllMarketsTrades: true,
  testAllMarketsTradesSuccess: 50,

  hasTickers: true,
  hasTrades: true,
  hasCandles: true,
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
    hasCount: false,
  },
});
