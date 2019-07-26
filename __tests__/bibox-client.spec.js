const { testClient } = require("./test-runner");
const BiboxClient = require("../src/exchanges/bibox-client");

testClient({
  client: BiboxClient,
  clientName: "BiboxClient",
  exchangeName: "Bibox",
  markets: [
    {
      id: "BTC_USDT",
      base: "BTC",
      quote: "USDT",
    },
    {
      id: "ETH_BTC",
      base: "ETH",
      quote: "BTC",
    },
  ],

  hasTickers: true,
  hasTrades: true,
  hasLevel2Snapshots: true,
  hasLevel2Updates: false,
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
    hasBid: true,
    hasBidVolume: false,
    hasAsk: true,
    hasAskVolume: false,
  },

  trade: {
    hasTradeId: false,
  },

  level2Snapshot: {
    hasTimestampMs: true,
    hasSequenceId: false,
    hasCount: false,
  },
});

//   test("should subscribe and emit level2 snapshots", done => {
//     client.subscribeLevel2Snapshots(market1);
//     client.on("l2snapshot", (snapshot, market) => {
//       expect(market).toBeDefined();
//       expect(market.id).toMatch(/BTC_USDT|ETH_BTC/);
//       expect(snapshot.fullId).toMatch(/Bibox:BTC\/USDT/);
//       expect(snapshot.exchange).toMatch("Bibox");
//       expect(snapshot.base).toMatch(market1.base);
//       expect(snapshot.quote).toMatch(market1.quote);
//       expect(snapshot.timestampMs).toBeGreaterThan(1553712743791);
//       expect(snapshot.sequenceId).toBeUndefined();
//       if (snapshot.asks.length) {
//         expect(parseFloat(snapshot.asks[0].price)).toBeGreaterThanOrEqual(0);
//         expect(parseFloat(snapshot.asks[0].size)).toBeGreaterThanOrEqual(0);
//       }
//       if (snapshot.bids.length) {
//         expect(parseFloat(snapshot.bids[0].price)).toBeGreaterThanOrEqual(0);
//         expect(parseFloat(snapshot.bids[0].size)).toBeGreaterThanOrEqual(0);
//       }
//       done();
//     });
//   }, 30000);

//   test("should close connections", done => {
//     client.on("closed", done);
//     client.close();
//   });
// });
