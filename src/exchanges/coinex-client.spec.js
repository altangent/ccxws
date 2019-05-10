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

let market3 = {
  id: "ETHBTC",
  base: "ETH",
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
    client.subscribeTicker(market3);
    client.on("ticker", function tickerHandler(ticker, market) {
      expect(market).toBeDefined();
      expect(market.id).toMatch(/ETHBTC/);
      expect(ticker.fullId).toMatch("Coinex:ETH/BTC");
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
      done();
    });
  }, 30000);

  test("should subscribe and emit trade events", done => {
    client.subscribeTrades(market1);
    client.on("trade", function tradeHandler(trade, market) {
      expect(market).toBeDefined();
      expect(market.id).toMatch(/BTCUSDT/);
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
      done();
    });
  }, 30000);

  test("should subscribe and emit level2 updates", done => {
    let hasSnapshot = false;
    client.subscribeLevel2Updates(market2);
    client.on("l2snapshot", (snapshot, market) => {
      hasSnapshot = true;
      expect(market).toBeDefined();
      expect(market.id).toMatch(/LTCBTC/);
      expect(snapshot.fullId).toMatch("Coinex:LTC/BTC");
      expect(snapshot.exchange).toMatch("Coinex");
      expect(snapshot.base).toMatch("LTC");
      expect(snapshot.quote).toMatch("BTC");
      expect(snapshot.sequenceId).toBeUndefined();
      if (snapshot.asks.length) {
        expect(parseFloat(snapshot.asks[0].price)).toBeGreaterThanOrEqual(0);
        expect(parseFloat(snapshot.asks[0].size)).toBeGreaterThanOrEqual(0);
      }
      if (snapshot.bids.length) {
        expect(parseFloat(snapshot.bids[0].price)).toBeGreaterThanOrEqual(0);
        expect(parseFloat(snapshot.bids[0].size)).toBeGreaterThanOrEqual(0);
      }
    });

    client.on("l2update", function level2UpdateHandler(update, market) {
      expect(market).toBeDefined();
      expect(market.id).toMatch(/LTCBTC/);
      expect(update.fullId).toMatch("Coinex:LTC/BTC");
      expect(update.exchange).toMatch("Coinex");
      expect(update.base).toMatch("LTC");
      expect(update.quote).toMatch("BTC");
      expect(update.sequenceId).toBeUndefined();
      if (update.asks.length) {
        expect(parseFloat(update.asks[0].price)).toBeGreaterThanOrEqual(0);
        expect(parseFloat(update.asks[0].size)).toBeGreaterThanOrEqual(0);
      }
      if (update.bids.length) {
        expect(parseFloat(update.bids[0].price)).toBeGreaterThanOrEqual(0);
        expect(parseFloat(update.bids[0].size)).toBeGreaterThanOrEqual(0);
      }
      if (hasSnapshot) done();
    });
  }, 15000);

  test("should unsubscribe from tickers", done => {
    client.unsubscribeTicker(market3);
    setTimeout(done, 1000);
  });

  test("should unsubscribe from trades", done => {
    client.unsubscribeTrades(market1);
    setTimeout(done, 1000);
  });

  test("should unsubscribe from level2 updates", done => {
    client.unsubscribeLevel2Updates(market2);
    setTimeout(done, 1000);
  });

  test("should close connections", async done => {
    client.on("closed", done);
    await client.close();
  });
});
