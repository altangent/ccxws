const Coinex = require("./coinex-client");
jest.mock("winston", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.retryTimes(3);

let client;
let market1 = {
  id: "BTCUSDT",
  base: "BTC",
  quote: "USDT",
};

let market2 = {
  id: "LTCBTC",
  base: "LTC",
  quote: "BTC",
};

describe("CoinexClient", () => {
  beforeAll(() => {
    client = new Coinex();
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

  test("should subscribe and emit ticker events", done => {
    client.subscribeTicker(market1);
    client.on("ticker", function tickerHandler(ticker) {
      expect(ticker.fullId).toMatch("Coinex:BTC/USDT");
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
      expect(parseFloat(ticker.bid)).toBe(NaN);
      expect(parseFloat(ticker.bidVolume)).toBe(NaN);
      expect(parseFloat(ticker.ask)).toBe(NaN);
      expect(parseFloat(ticker.askVolume)).toBe(NaN);

      // Need to remove this listener, otherwise it is still running during subsequent tests
      client.removeListener("ticker", tickerHandler);
      client.unsubscribeTicker(market1);
      done();
    });
  }, 30000);

  test("should subscribe and emit trade events", done => {
    client.subscribeTrades(market1);
    client.on("trade", function tradeHandler(trade) {
      expect(trade.fullId).toMatch("Coinex:BTC/USDT");
      expect(trade.exchange).toMatch("Coinex");
      expect(trade.base).toMatch("BTC");
      expect(trade.quote).toMatch("USDT");
      expect(trade.tradeId).toBeGreaterThan(0);
      expect(trade.unix).toBeGreaterThan(1522540800000);
      expect(trade.side).toMatch(/buy|sell/);
      expect(typeof trade.price).toBe("string");
      expect(typeof trade.amount).toBe("string");
      expect(parseFloat(trade.price)).toBeGreaterThan(0);

      // Need to remove this listener, otherwise it is still running during subsequent tests
      client.removeListener("trade", tradeHandler);
      client.unsubscribeTrades(market1);
      done();
    });
  }, 30000);

  test("should subscribe and emit level2 updates", done => {
    client.subscribeLevel2Updates(market1);

    client.on("l2update", function level2UpdateHandler(update) {
      expect(update.fullId).toMatch("Coinex:BTC/USDT");
      expect(update.exchange).toMatch("Coinex");
      expect(update.base).toMatch("BTC");
      expect(update.quote).toMatch("USDT");
      expect(update.sequenceId).toBeUndefined();
      if (update.asks.length) {
        expect(parseFloat(update.asks[0].price)).toBeGreaterThanOrEqual(0);
        expect(parseFloat(update.asks[0].size)).toBeGreaterThanOrEqual(0);
      }
      if (update.bids.length) {
        expect(parseFloat(update.bids[0].price)).toBeGreaterThanOrEqual(0);
        expect(parseFloat(update.bids[0].size)).toBeGreaterThanOrEqual(0);
      }

      // Need to remove this listener, otherwise it is still running during subsequent tests
      client.removeListener("l2update", level2UpdateHandler);
      client.unsubscribeLevel2Updates(market1);
      done();
    });
  }, 30000);

  test("should subscribe and emit tickers for 2 markets", done => {
    let receivedMarket1Update = false;
    let receivedMarket2Update = false;

    client.subscribeTicker(market1);
    client.subscribeTicker(market2);

    client.on("ticker", function tickerHandler(t) {
      expect(t.base + t.quote).toMatch(/BTCUSDT|LTCBTC/);

      if (t.base + t.quote === "BTCUSDT") {
        receivedMarket1Update = true;
      } else if (t.base + t.quote === "LTCBTC") {
        receivedMarket2Update = true;
      }

      if (receivedMarket1Update && receivedMarket2Update) {
        // Need to remove this listener, otherwise it is still running during subsequent tests
        client.removeListener("ticker", tickerHandler);
        client.unsubscribeTicker(market1);
        client.unsubscribeTicker(market2);
        done();
      }
    });
  }, 30000);

  test("should subscribe and emit tickers for tickers, trades, and l2updates for the same market", done => {
    let receivedTickerUpdate = false;
    let receivedTradeUpdate = false;
    let receivedL2Update = false;

    client.subscribeTicker(market1);
    client.subscribeTrades(market1);
    client.subscribeLevel2Updates(market1);

    function check() {
      if (receivedTickerUpdate && receivedTradeUpdate && receivedL2Update) {
        done();
      }
    }

    client.on("ticker", () => {
      receivedTickerUpdate = true;
      check();
    });
    client.on("trade", () => {
      receivedTradeUpdate = true;
      check();
    });
    client.on("l2update", () => {
      receivedL2Update = true;
      check();
    });
  }, 90000);

  test("should close connections", done => {
    client.on("closed", done);
    client.close();
  });
});
