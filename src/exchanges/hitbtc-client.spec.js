const HitBTC = require("./hitbtc-client");
jest.mock("winston", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.retryTimes(3);

let client;
let market = {
  id: "ETHBTC",
  base: "ETH",
  quote: "BTC",
};

describe("HitBTC", () => {
  beforeAll(() => {
    client = new HitBTC();
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
    client.subscribeTicker(market);
    client.on("ticker", ticker => {
      expect(ticker.fullId).toMatch("HitBTC:ETH/BTC");
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
      expect(typeof ticker.ask).toBe("string");
      expect(parseFloat(ticker.last)).toBeGreaterThan(0);
      expect(parseFloat(ticker.open)).toBeGreaterThan(0);
      expect(parseFloat(ticker.high)).toBeGreaterThan(0);
      expect(parseFloat(ticker.low)).toBeGreaterThan(0);
      expect(parseFloat(ticker.volume)).toBeGreaterThan(0);
      expect(parseFloat(ticker.quoteVolume)).toBeGreaterThan(0);
      expect(isNaN(parseFloat(ticker.change))).toBeFalsy();
      expect(isNaN(parseFloat(ticker.changePercent))).toBeFalsy();
      expect(parseFloat(ticker.bid)).toBeGreaterThan(0);
      expect(ticker.bidVolume).toBeUndefined();
      expect(parseFloat(ticker.ask)).toBeGreaterThan(0);
      expect(ticker.askVolume).toBeUndefined();
      done();
    });
  }, 10000);

  test("should subscribe and emit trade events", done => {
    client.subscribeTrades(market);
    client.on("trade", trade => {
      expect(trade.fullId).toMatch("HitBTC:ETH/BTC");
      expect(trade.exchange).toMatch("HitBTC");
      expect(trade.base).toMatch("ETH");
      expect(trade.quote).toMatch("BTC");
      expect(trade.tradeId).toBeGreaterThan(0);
      expect(trade.unix).toBeGreaterThan(1522540800000);
      expect(trade.side).toMatch(/buy|sell/);
      expect(typeof trade.price).toBe("string");
      expect(typeof trade.amount).toBe("string");
      expect(parseFloat(trade.price)).toBeGreaterThan(0);
      expect(parseFloat(trade.amount)).toBeGreaterThan(0);
      done();
    });
  }, 30000);

  test("should subscribe and emit level2 snapshot and updates", done => {
    let hasSnapshot = false;
    client.subscribeLevel2Updates(market);
    client.on("l2snapshot", snapshot => {
      hasSnapshot = true;
      expect(snapshot.fullId).toMatch("HitBTC:ETH/BTC");
      expect(snapshot.exchange).toMatch("HitBTC");
      expect(snapshot.base).toMatch("ETH");
      expect(snapshot.quote).toMatch("BTC");
      expect(snapshot.sequenceId).toBeGreaterThan(0);
      expect(snapshot.timestampMs).toBeUndefined();
      expect(parseFloat(snapshot.asks[0].price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(snapshot.asks[0].size)).toBeGreaterThanOrEqual(0);
      expect(snapshot.asks[0].count).toBeUndefined();
      expect(parseFloat(snapshot.bids[0].price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(snapshot.bids[0].size)).toBeGreaterThanOrEqual(0);
      expect(snapshot.bids[0].count).toBeUndefined();
    });
    client.on("l2update", update => {
      expect(hasSnapshot).toBeTruthy();
      expect(update.fullId).toMatch("HitBTC:ETH/BTC");
      expect(update.exchange).toMatch("HitBTC");
      expect(update.base).toMatch("ETH");
      expect(update.quote).toMatch("BTC");
      expect(update.sequenceId).toBeGreaterThan(0);
      expect(update.timestampMs).toBeUndefined();
      let point = update.asks[0] || update.bids[0];
      expect(parseFloat(point.price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(point.size)).toBeGreaterThanOrEqual(0);
      expect(point.count).toBeUndefined();
      done();
    });
  });

  test("should unsubscribe from tickers", () => {
    client.unsubscribeTicker(market);
  });

  test("should unsubscribe from trades", () => {
    client.unsubscribeTrades(market);
  });

  test("should unusbscribe from level2 updates", () => {
    client.unsubscribeLevel2Updates(market);
  });

  test("should close connections", done => {
    client.on("closed", done);
    client.close();
  });
});
