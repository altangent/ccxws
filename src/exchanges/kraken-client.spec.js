const Kraken = require("./kraken-client");
jest.mock("winston", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.retryTimes(3);

function wait(timeout = 1000) {
  return new Promise(resolve => {
    setTimeout(resolve, timeout);
  });
}

describe("kraken-client", () => {
  let client;
  const market1 = {
    id: "XBT/EUR",
    base: "XBT",
    quote: "EUR",
  };
  
  const market2 = {
    id: "ETH/USD",
    base: "ETH",
    quote: "USD",
  };

  beforeEach(() => {
    client = new Kraken();
  });

  afterEach(() => {
    client.close();
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

  test(
    "should subscribe and emit ticker events",
    done => {
      client.subscribeTicker(market1);
      client.on("ticker", ticker => {
        expect(ticker.fullId).toMatch("Kraken:" + market1.base + "/" + market1.quote);
        expect(ticker.timestamp).toBeGreaterThan(1531677480465);

        expect(typeof ticker.last).toBe("undefined");
        expect(typeof ticker.open).toBe("string");
        expect(typeof ticker.high).toBe("string");
        expect(typeof ticker.low).toBe("string");
        expect(typeof ticker.volume).toBe("string");
        expect(typeof ticker.quoteVolume).toBe("undefined");
        expect(typeof ticker.change).toBe("undefined");
        expect(typeof ticker.changePercent).toBe("undefined");
        expect(typeof ticker.bid).toBe("string");
        expect(typeof ticker.bidVolume).toBe("string");
        expect(typeof ticker.ask).toBe("string");
        expect(typeof ticker.askVolume).toBe("string");
        expect(parseFloat(ticker.last)).toBe(NaN);
        expect(parseFloat(ticker.open)).toBeGreaterThan(0);
        expect(parseFloat(ticker.high)).toBeGreaterThan(0);
        expect(parseFloat(ticker.low)).toBeGreaterThan(0);
        expect(parseFloat(ticker.volume)).toBeGreaterThan(0);
        expect(parseFloat(ticker.quoteVolume)).toBe(NaN);
        expect(isNaN(parseFloat(ticker.change))).toBeTruthy();
        expect(isNaN(parseFloat(ticker.changePercent))).toBeTruthy();
        expect(isNaN(parseFloat(ticker.bid))).toBeFalsy();
        expect(isNaN(parseFloat(ticker.bidVolume))).toBeFalsy();
        expect(isNaN(parseFloat(ticker.ask))).toBeFalsy();
        expect(isNaN(parseFloat(ticker.askVolume))).toBeFalsy();

        done();
      });
    },
    30000
  );

  test(
    "should unsubscribe from ticker events",
    async () => {
      client = new Kraken();
      client.subscribeTicker(market1);//duplicate test
      await wait();
      client.unsubscribeTicker(market1);
      await wait();
    },
    30000
  );

  test(
    "should subscribe and emit trade events",
    done => {
      client.subscribeTrades(market1);
      client.on("trade", trade => {
        expect(trade.fullId).toMatch("Kraken:" + market1.base + "/" + market1.quote);
        expect(trade.exchange).toMatch("Kraken");
        expect(trade.base).toMatch(market1.base);
        expect(trade.quote).toMatch(market1.quote);
        expect(trade.unix).toBeGreaterThan(1522540800000);
        expect(trade.side).toMatch(/buy|sell/);
        expect(typeof trade.price).toBe("string");
        expect(typeof trade.amount).toBe("string");
        expect(typeof trade.tradeId).toBe("undefined");
        expect(parseFloat(trade.price)).toBeGreaterThan(0);
        expect(parseFloat(trade.amount)).toBeGreaterThan(0);
        done();
      });
    },
    30000
  );

  test(
    "should unsubscribe from trade events",
    async () => {
      client.subscribeTrades(market1);//duplicate test
      await wait();
      client.unsubscribeTrades(market1);
      await wait();
    },
    30000
  );

  test(
    "should unsubscribe from l2 orderbook events",
    async () => {
      client.subscribeLevel2Updates(market1);//duplicate test
      await wait();
      client.unsubscribeLevel2Updates(market1);
      await wait();
    },
    30000
  );

  test(
    "should subscribe and emit tickers for tickers, trades, and l2orderbook for the same market",
    done => {
      let hasTicker = false;
      let hasTrade = false;
      let hasL2Snap = false;
      let hasL2AUpd = false;
      let hasL2BUpd = false;

      client.subscribeTicker(market1);
      client.subscribeTrades(market1);
      client.subscribeLevel2Updates(market1);

      function fin() {
        if (hasTrade && hasL2Snap && hasTicker && hasL2AUpd && hasL2BUpd) {
          done();
        }
      }

      client.on("ticker", t => {
        expect(t.base + t.quote).toMatch(/XBTEUR|ETHUSD/);
        hasTicker = true;
        fin();
      });
      client.on("trade", t => {
        expect(t.base + t.quote).toMatch(/XBTEUR|ETHUSD/);
        hasTrade = true;
        fin();
      });
      client.on("l2snapshot", t => {
        expect(t.base + t.quote).toMatch(/XBTEUR|ETHUSD/);

        expect(t.asks.length).toBeGreaterThan(0);
        expect(t.bids.length).toBeGreaterThan(0);
        expect(typeof t.asks[0].price).toBe("string");
        expect(typeof t.asks[0].size).toBe("string");
        expect(typeof t.bids[0].price).toBe("string");
        expect(typeof t.bids[0].size).toBe("string");
        expect(parseFloat(t.asks[0].price)).toBeGreaterThanOrEqual(0);
        expect(parseFloat(t.asks[0].size)).toBeGreaterThanOrEqual(0);
        expect(parseFloat(t.bids[0].price)).toBeGreaterThanOrEqual(0);
        expect(parseFloat(t.bids[0].size)).toBeGreaterThanOrEqual(0);

        hasL2Snap = true;
        fin();
      });
      client.on("l2update", update => {
        expect(update.base + update.quote).toMatch(/XBTEUR|ETHUSD/);
        expect(update.timestampMs).toBeGreaterThan(1522540800000);
        expect(update.asks.length || update.bids.length).toBeGreaterThan(0);

        if(update.asks.length){
          expect(typeof update.asks[0].price).toBe("string");
          expect(typeof update.asks[0].size).toBe("string");
          expect(parseFloat(update.asks[0].price)).toBeGreaterThanOrEqual(0);
          expect(parseFloat(update.asks[0].size)).toBeGreaterThanOrEqual(0);
          hasL2AUpd = true;
        }

        if(update.bids.length){
          expect(typeof update.bids[0].price).toBe("string");
          expect(typeof update.bids[0].size).toBe("string");
          expect(parseFloat(update.bids[0].price)).toBeGreaterThanOrEqual(0);
          expect(parseFloat(update.bids[0].size)).toBeGreaterThanOrEqual(0);
          hasL2BUpd = true;
        }

        fin();
      });
    },
    30000
  );

  test(
    "should subscribe and emit trades for 2 markets",
    done => {
      let hasMarket1 = false;
      let hasMarket2 = false;

      client.subscribeTrades(market1);
      client.subscribeTrades(market2);

      client.on("trade", trade => {
        expect(trade.base + trade.quote).toMatch(/XBTEUR|ETHUSD/);

        if (trade.base + trade.quote === market1.base + market1.quote) {
          hasMarket1 = true;
        } else if (trade.base + trade.quote === market2.base + market2.quote) {
          hasMarket2 = true;
        }

        if (hasMarket1 && hasMarket2) {
          done();
        }
      });
    },
    90000
  );


  test(
    "should subscribe and emit tickers for 2 markets",
    done => {
      let hasMarket1 = false;
      let hasMarket2 = false;

      client.subscribeTicker(market1);
      client.subscribeTicker(market2);

      client.on("ticker", ticker => {
        expect(ticker.base + ticker.quote).toMatch(/XBTEUR|ETHUSD/);

        if (ticker.base + ticker.quote === market1.base + market1.quote) {
          hasMarket1 = true;
        } else if (ticker.base + ticker.quote === market2.base + market2.quote) {
          hasMarket2 = true;
        }

        if (hasMarket1 && hasMarket2) {
          done();
        }
      });
    },
    90000
  );

  test(
    "should subscribe and emit Level 2 updates for 2 markets",
    done => {
      let hasMarket1 = false;
      let hasMarket2 = false;

      client.subscribeLevel2Updates(market1);
      client.subscribeLevel2Updates(market2);

      client.on("l2update", l2update => {
        expect(l2update.base + l2update.quote).toMatch(/XBTEUR|ETHUSD/);

        if (l2update.base + l2update.quote === market1.base + market1.quote) {
          hasMarket1 = true;
        } else if (l2update.base + l2update.quote === market2.base + market2.quote) {
          hasMarket2 = true;
        }

        if (hasMarket1 && hasMarket2) {
          done();
        }
      });
    },
    90000
  );

  test("should close connections", done => {
    client.on("closed", done);
    client.close();
  });
});
