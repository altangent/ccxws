const Kraken = require("./kraken-client");
jest.mock("winston", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.retryTimes(3);

function wait(timeout = 1000) {
  return new Promise(resolve => {
    setTimeout(resolve, timeout);
  });
}

describe("KrakenClient", () => {
  describe("kraken-client", () => {
    let client;
    const market1 = {
      id: "XXBTZEUR",
      base: "BTC",
      quote: "EUR",
    };

    describe("properties", () => {
      beforeAll(() => {
        client = new Kraken();
      });

      test("it should support tickers", () => {
        expect(client.hasTickers).toBeTruthy();
      });

      test("it should support trades", () => {
        expect(client.hasTrades).toBeTruthy();
      });

      test("it should not support level2 snapshots", () => {
        expect(client.hasLevel2Snapshots).toBeFalsy();
      });

      test("it should support level2 updates", () => {
        expect(client.hasLevel2Updates).toBeTruthy();
      });

      test("it should not support level3 snapshots", () => {
        expect(client.hasLevel3Snapshots).toBeFalsy();
      });

      test("it should not support level3 updates", () => {
        expect(client.hasLevel3Updates).toBeFalsy();
      });
    });

    describe("integration", () => {
      beforeAll(async () => {
        client = new Kraken();
        await client.loadSymbolMaps();
      });

      test("should subscribe and emit ticker events", done => {
        client.subscribeTicker(market1);
        client.on("ticker", ticker => {
          expect(ticker.fullId).toMatch("Kraken:" + market1.base + "/" + market1.quote);
          expect(ticker.timestamp).toBeGreaterThan(1531677480465);
          expect(typeof ticker.last).toBe("string");
          expect(typeof ticker.open).toBe("string");
          expect(typeof ticker.high).toBe("string");
          expect(typeof ticker.low).toBe("string");
          expect(typeof ticker.volume).toBe("string");
          expect(typeof ticker.quoteVolume).toBe("string");
          expect(typeof ticker.change).toBe("string");
          expect(typeof ticker.changePercent).toBe("string");
          expect(typeof ticker.bid).toBe("string");
          expect(typeof ticker.bidVolume).toBe("string");
          expect(typeof ticker.ask).toBe("string");
          expect(typeof ticker.askVolume).toBe("string");
          expect(parseFloat(ticker.last)).toBeGreaterThan(0);
          expect(parseFloat(ticker.open)).toBeGreaterThan(0);
          expect(parseFloat(ticker.high)).toBeGreaterThan(0);
          expect(parseFloat(ticker.low)).toBeGreaterThan(0);
          expect(parseFloat(ticker.volume)).toBeGreaterThan(0);
          expect(parseFloat(ticker.quoteVolume)).toBeGreaterThan(0);
          expect(isNaN(parseFloat(ticker.change))).toBeFalsy();
          expect(isNaN(parseFloat(ticker.changePercent))).toBeFalsy();
          expect(parseFloat(ticker.bid)).toBeGreaterThan(0);
          expect(parseFloat(ticker.bidVolume)).toBeGreaterThan(0);
          expect(parseFloat(ticker.ask)).toBeGreaterThan(0);
          expect(parseFloat(ticker.askVolume)).toBeGreaterThan(0);
          done();
        });
      }, 30000);

      test("should unsubscribe from ticker events", async () => {
        client.unsubscribeTicker(market1);
        await wait();
      }, 30000);

      test("should subscribe and emit trade events", done => {
        client.subscribeTrades(market1);
        client.on("trade", trade => {
          expect(trade.fullId).toMatch("Kraken:" + market1.base + "/" + market1.quote);
          expect(trade.exchange).toMatch("Kraken");
          expect(trade.base).toMatch(market1.base);
          expect(trade.quote).toMatch(market1.quote);
          expect(trade.tradeId).toMatch(/\d{19,}/);
          expect(trade.unix).toBeGreaterThan(1522540800000);
          expect(trade.side).toMatch(/buy|sell/);
          expect(typeof trade.price).toBe("string");
          expect(typeof trade.amount).toBe("string");
          expect(parseFloat(trade.price)).toBeGreaterThan(0);
          expect(parseFloat(trade.amount)).toBeGreaterThan(0);
          done();
        });
      }, 30000);

      test("should unsubscribe from trade events", async () => {
        client.unsubscribeTrades(market1);
        await wait();
      }, 30000);

      test("should subscribe and emit l2orderbook snapshot and updates", done => {
        let hasL2Snapshot = false;
        let hasL2AskUpdate = false;
        let hasL2BidUpdate = false;

        client.subscribeLevel2Updates(market1);

        function fin() {
          if (hasL2Snapshot && hasL2AskUpdate && hasL2BidUpdate) {
            done();
          }
        }

        client.on("l2snapshot", s => {
          expect(s.fullId).toBe("Kraken:BTC/EUR");
          expect(s.exchange).toBe("Kraken");
          expect(s.base).toBe("BTC");
          expect(s.quote).toBe("EUR");
          expect(s.timestampMs).toBeGreaterThan(1522540800000);
          expect(s.asks.length).toBeGreaterThan(0);
          expect(s.bids.length).toBeGreaterThan(0);
          expect(typeof s.asks[0].price).toBe("string");
          expect(typeof s.asks[0].size).toBe("string");
          expect(typeof s.bids[0].price).toBe("string");
          expect(typeof s.bids[0].size).toBe("string");
          expect(parseFloat(s.asks[0].price)).toBeGreaterThanOrEqual(0);
          expect(parseFloat(s.asks[0].size)).toBeGreaterThanOrEqual(0);
          expect(parseFloat(s.bids[0].price)).toBeGreaterThanOrEqual(0);
          expect(parseFloat(s.bids[0].size)).toBeGreaterThanOrEqual(0);
          hasL2Snapshot = true;
          fin();
        });
        client.on("l2update", u => {
          expect(u.fullId).toBe("Kraken:BTC/EUR");
          expect(u.exchange).toBe("Kraken");
          expect(u.base).toBe("BTC");
          expect(u.quote).toBe("EUR");
          expect(u.timestampMs).toBeGreaterThan(1522540800000);
          expect(u.asks.length || u.bids.length).toBeGreaterThan(0);
          if (u.asks.length) {
            expect(typeof u.asks[0].price).toBe("string");
            expect(typeof u.asks[0].size).toBe("string");
            expect(parseFloat(u.asks[0].price)).toBeGreaterThanOrEqual(0);
            expect(parseFloat(u.asks[0].size)).toBeGreaterThanOrEqual(0);
            hasL2AskUpdate = true;
          }

          if (u.bids.length) {
            expect(typeof u.bids[0].price).toBe("string");
            expect(typeof u.bids[0].size).toBe("string");
            expect(parseFloat(u.bids[0].price)).toBeGreaterThanOrEqual(0);
            expect(parseFloat(u.bids[0].size)).toBeGreaterThanOrEqual(0);
            hasL2BidUpdate = true;
          }
          fin();
        });
      }, 30000);

      test("should unsubscribe from l2 orderbook events", async () => {
        client.unsubscribeLevel2Updates(market1);
        await wait();
      }, 30000);

      test("should close connections", done => {
        client.on("closed", done);
        client.close();
      });
    });

    describe("_createTradeId", () => {
      beforeAll(() => {
        client = new Kraken();
      });
      let fixtures = [
        { input: "1554844504.300156", expected: "1554844504300200000" },
        { input: "1554844623.538850", expected: "1554844623538800000" },
        { input: "1554844623.538851", expected: "1554844623538900000" },
        { input: "1554845489.660651", expected: "1554845489660700000" },
        { input: "1554845489.665608", expected: "1554845489665600000" },
        { input: "1554845489.668115", expected: "1554845489668100000" },
        { input: "1554845521.452880", expected: "1554845521452900000" },
      ];
      for (let fixture of fixtures) {
        test("should create " + fixture.expected, () => {
          let actual = client._createTradeId(fixture.input);
          expect(actual).toBe(fixture.expected);
        });
      }
    });
  });
});
