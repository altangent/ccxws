const Upbit = require("./upbit-client");
jest.mock("winston", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.retryTimes(3);

function wait(timeout = 1000) {
  return new Promise(resolve => {
    setTimeout(resolve, timeout);
  });
}

describe("UpbitClient", () => {
  let client;
  const market1 = {
    id: "KRW-BTC",
    base: "KRW",
    quote: "BTC",
  };

  const market2 = {
    id: "KRW-BTT",
    base: "KRW",
    quote: "BTT",
  };

  beforeEach(() => {
    client = new Upbit();
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
    expect(client.hasLevel2Snapshots).toBeTruthy();
  });

  test("it should support level2 updates", () => {
    expect(client.hasLevel2Updates).toBeFalsy();
  });

  test("it should not support level3 snapshots", () => {
    expect(client.hasLevel3Snapshots).toBeFalsy();
  });

  test("it should not support level3 updates", () => {
    expect(client.hasLevel3Updates).toBeFalsy();
  });

  test("should subscribe and emit ticker events", done => {
    client.subscribeTicker(market1);
    client.on("ticker", (ticker, market) => {
      expect(market).toBeDefined();
      expect(market.id).toMatch(/KRW-BTC|KRW-BTT/);
      expect(ticker.fullId).toMatch("Upbit:" + market1.base + "/" + market1.quote);
      expect(ticker.timestamp).toBeGreaterThan(1531677480465);
      expect(typeof ticker.last).toBe("string");
      expect(typeof ticker.open).toBe("string");
      expect(typeof ticker.high).toBe("string");
      expect(typeof ticker.low).toBe("string");
      expect(typeof ticker.volume).toBe("string");
      expect(typeof ticker.quoteVolume).toBe("string");
      expect(typeof ticker.change).toBe("string");
      expect(typeof ticker.changePercent).toBe("string");
      expect(typeof ticker.bid).toBe("undefined");
      expect(typeof ticker.bidVolume).toBe("undefined");
      expect(typeof ticker.ask).toBe("undefined");
      expect(typeof ticker.askVolume).toBe("undefined");
      expect(parseFloat(ticker.last)).toBeGreaterThan(0);
      expect(parseFloat(ticker.open)).toBeGreaterThan(0);
      expect(parseFloat(ticker.high)).toBeGreaterThan(0);
      expect(parseFloat(ticker.low)).toBeGreaterThan(0);
      expect(parseFloat(ticker.volume)).toBeGreaterThan(0);
      expect(parseFloat(ticker.quoteVolume)).toBeGreaterThan(0);
      expect(isNaN(parseFloat(ticker.change))).toBeFalsy();
      expect(isNaN(parseFloat(ticker.changePercent))).toBeFalsy();
      done();
    });
  }, 30000);

  test("should unsubscribe from ticker events", async () => {
    client = new Upbit();
    client.subscribeTicker(market1);
    await wait();
    client.unsubscribeTicker(market1);
    await wait();
  }, 30000);

  test("should subscribe and emit trade events", done => {
    client.subscribeTrades(market1);
    client.on("trade", (trade, market) => {
      expect(market).toBeDefined();
      expect(market.id).toMatch(/KRW-BTC|KRW-BTT/);
      expect(trade.fullId).toMatch("Upbit:" + market1.base + "/" + market1.quote);
      expect(trade.exchange).toMatch("Upbit");
      expect(trade.base).toMatch(market1.base);
      expect(trade.quote).toMatch(market1.quote);
      expect(trade.unix).toBeGreaterThan(1522540800000);
      expect(trade.side).toMatch(/buy|sell/);
      expect(typeof trade.price).toBe("string");
      expect(typeof trade.amount).toBe("string");
      expect(typeof trade.tradeId).toBe("string");
      expect(parseFloat(trade.tradeId)).toBeGreaterThan(0);
      expect(parseFloat(trade.price)).toBeGreaterThan(0);
      expect(parseFloat(trade.amount)).toBeGreaterThan(0);
      done();
    });
  }, 30000);

  test("should unsubscribe from trade events", async () => {
    client.subscribeTrades(market1);
    await wait();
    client.unsubscribeTrades(market1);
    await wait();
  }, 30000);

  test("should subscribe and emit level2 snapshots", done => {
    client.subscribeLevel2Snapshots(market1);
    client.on("l2snapshot", (update, market) => {
      expect(market).toBeDefined();
      expect(market.id).toMatch(/KRW-BTC|KRW-BTT/);
      expect(update.fullId).toMatch("Upbit:" + market1.base + "/" + market1.quote);
      expect(update.exchange).toMatch("Upbit");
      expect(update.base).toMatch(market1.base);
      expect(update.quote).toMatch(market1.quote);
      expect(update.sequenceId).toBeUndefined();
      expect(update.timestampMs).toBeGreaterThan(1522540800000);
      expect(update.asks.length).toBeGreaterThan(0);
      expect(update.bids.length).toBeGreaterThan(0);
      expect(typeof update.asks[0].price).toBe("string");
      expect(typeof update.asks[0].size).toBe("string");
      expect(typeof update.bids[0].price).toBe("string");
      expect(typeof update.bids[0].size).toBe("string");
      expect(parseFloat(update.asks[0].price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(update.asks[0].size)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(update.bids[0].price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(update.bids[0].size)).toBeGreaterThanOrEqual(0);
      done();
    });
  }, 30000);

  test("should unsubscribe from l2 orderbook events", async () => {
    client.subscribeLevel2Snapshots(market1);
    await wait();
    client.unsubscribeLevel2Snapshots(market1);
    await wait();
  }, 30000);

  test("should subscribe and emit tickers for tickers, trades, and l2orderbook for the same market", done => {
    let hasTicker = false;
    let hasTrade = false;
    let hasL2Snap = false;

    client.subscribeTicker(market1);
    client.subscribeTrades(market1);
    client.subscribeLevel2Snapshots(market1);

    function fin() {
      if (hasTrade && hasL2Snap && hasTicker) {
        done();
      }
    }

    client.on("ticker", t => {
      expect(t.base + t.quote).toMatch(/KRWBTT|KRWBTC/);
      hasTicker = true;
      fin();
    });
    client.on("trade", t => {
      expect(t.base + t.quote).toMatch(/KRWBTT|KRWBTC/);
      hasTrade = true;
      fin();
    });
    client.on("l2snapshot", t => {
      expect(t.base + t.quote).toMatch(/KRWBTT|KRWBTC/);
      hasL2Snap = true;
      fin();
    });
  }, 30000);

  test("should subscribe and emit trades for 2 markets", done => {
    let hasMarket1 = false;
    let hasMarket2 = false;

    client.subscribeTrades(market1);
    client.subscribeTrades(market2);

    client.on("trade", trade => {
      expect(trade.base + trade.quote).toMatch(/KRWBTT|KRWBTC/);

      if (trade.base + trade.quote === market1.base + market1.quote) {
        hasMarket1 = true;
      } else if (trade.base + trade.quote === market2.base + market2.quote) {
        hasMarket2 = true;
      }

      if (hasMarket1 && hasMarket2) {
        done();
      }
    });
  }, 60000);

  test("should close connections", done => {
    client.on("closed", done);
    client.close();
  });
});
