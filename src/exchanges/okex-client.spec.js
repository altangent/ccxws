const OKEx = require("./okex-client");
jest.mock("winston", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.retryTimes(3);

let client;
let market = {
  id: "ETH-BTC",
  base: "ETH",
  quote: "BTC",
};

describe("OKExClient", () => {
  beforeAll(() => {
    client = new OKEx();
  });

  test("it should support tickers", () => {
    expect(client.hasTickers).toBeTruthy();
  });

  test("it should support trades", () => {
    expect(client.hasTrades).toBeTruthy();
  });

  test("it should support level2 snapshots", () => {
    expect(client.hasLevel2Snapshots).toBeTruthy();
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
    client.on("ticker", (ticker, market) => {
      expect(market).toBeDefined();
      expect(market.id).toMatch(/ETH-BTC/);
      expect(ticker.fullId).toMatch("OKEx:ETH/BTC");
      expect(ticker.timestamp).toBeGreaterThan(1531677480465);
      expect(typeof ticker.last).toBe("string");
      expect(typeof ticker.open).toBe("string");
      expect(typeof ticker.high).toBe("string");
      expect(typeof ticker.low).toBe("string");
      expect(typeof ticker.volume).toBe("string");
      expect(typeof ticker.change).toBe("string");
      expect(typeof ticker.changePercent).toBe("string");
      expect(typeof ticker.bid).toBe("string");
      expect(typeof ticker.ask).toBe("string");
      expect(parseFloat(ticker.last)).toBeGreaterThan(0);
      expect(parseFloat(ticker.open)).toBeGreaterThan(0);
      expect(parseFloat(ticker.high)).toBeGreaterThan(0);
      expect(parseFloat(ticker.low)).toBeGreaterThan(0);
      expect(parseFloat(ticker.volume)).toBeGreaterThan(0);
      expect(isNaN(parseFloat(ticker.change))).toBeFalsy();
      expect(isNaN(parseFloat(ticker.changePercent))).toBeFalsy();
      expect(parseFloat(ticker.bid)).toBeGreaterThan(0);
      expect(ticker.bidVolume).toBeUndefined();
      expect(parseFloat(ticker.ask)).toBeGreaterThan(0);
      expect(ticker.askVolume).toBeUndefined();
      done();
    });
  }, 10000);

  test("should unsubscribe from tickers", () => {
    client.unsubscribeTicker(market);
  });

  test("should subscribe and emit trade events", done => {
    client.subscribeTrades(market);
    client.on("trade", (trade, market) => {
      expect(market).toBeDefined();
      expect(market.id).toMatch(/ETH-BTC/);
      expect(trade.fullId).toMatch("OKEx:ETH/BTC");
      expect(trade.exchange).toMatch("OKEx");
      expect(trade.base).toMatch("ETH");
      expect(trade.quote).toMatch("BTC");
      expect(typeof trade.tradeId).toBe("string");
      expect(typeof trade.price).toBe("string");
      expect(typeof trade.amount).toBe("string");
      expect(parseInt(trade.tradeId)).toBeGreaterThan(0);
      expect(trade.unix).toBeGreaterThan(1522540800000);
      expect(trade.side).toMatch(/buy|sell/);
      expect(parseFloat(trade.price)).toBeGreaterThan(0);
      expect(parseFloat(trade.amount)).toBeGreaterThan(0);
      done();
    });
  }, 30000);

  test("should unsubscribe from trades", () => {
    client.unsubscribeTrades(market);
  });

  test("should subscribe and emit level2 snapshots", done => {
    client.subscribeLevel2Snapshots(market);
    client.on("l2snapshot", (snapshot, market) => {
      expect(market).toBeDefined();
      expect(market.id).toMatch(/ETH-BTC/);
      expect(snapshot.fullId).toMatch("OKEx:ETH/BTC");
      expect(snapshot.exchange).toMatch("OKEx");
      expect(snapshot.base).toMatch("ETH");
      expect(snapshot.quote).toMatch("BTC");
      expect(snapshot.sequenceId).toBeUndefined();
      expect(snapshot.timestampMs).toBeGreaterThan(0);
      expect(parseFloat(snapshot.asks[0].price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(snapshot.asks[0].size)).toBeGreaterThanOrEqual(0);
      expect(parseInt(snapshot.asks[0].count)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(snapshot.bids[0].price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(snapshot.bids[0].size)).toBeGreaterThanOrEqual(0);
      expect(parseInt(snapshot.bids[0].count)).toBeGreaterThanOrEqual(0);
      done();
    });
  }, 15000);

  test("should unsubscribe from level2 snapshots", () => {
    client.unsubscribeLevel2Snapshots(market);
  });

  test("should subscribe and emit level2 updates", done => {
    let hasSnapshot = false;
    client.subscribeLevel2Updates(market);
    client.on("l2snapshot", (snapshot, market) => {
      hasSnapshot = true;
      expect(market).toBeDefined();
      expect(market.id).toMatch(/ETH-BTC/);
      expect(snapshot.fullId).toMatch("OKEx:ETH/BTC");
      expect(snapshot.exchange).toMatch("OKEx");
      expect(snapshot.base).toMatch("ETH");
      expect(snapshot.quote).toMatch("BTC");
      expect(snapshot.sequenceId).toBeUndefined();
      expect(snapshot.timestampMs).toBeGreaterThan(0);
      expect(snapshot.checksum).toBeDefined();
      expect(parseFloat(snapshot.asks[0].price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(snapshot.asks[0].size)).toBeGreaterThanOrEqual(0);
      expect(parseInt(snapshot.asks[0].count)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(snapshot.bids[0].price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(snapshot.bids[0].size)).toBeGreaterThanOrEqual(0);
      expect(parseInt(snapshot.bids[0].count)).toBeGreaterThanOrEqual(0);
    });
    client.on("l2update", (update, market) => {
      expect(hasSnapshot).toBeTruthy();
      expect(market).toBeDefined();
      expect(market.id).toMatch(/ETH-BTC/);
      expect(update.fullId).toMatch("OKEx:ETH/BTC");
      expect(update.exchange).toMatch("OKEx");
      expect(update.base).toMatch("ETH");
      expect(update.quote).toMatch("BTC");
      expect(update.sequenceId).toBeUndefined();
      expect(update.timestampMs).toBeGreaterThan(0);
      expect(update.checksum).toBeDefined();
      let point = update.asks[0] || update.bids[0];
      expect(parseFloat(point.price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(point.size)).toBeGreaterThanOrEqual(0);
      expect(parseInt(point.count)).toBeGreaterThanOrEqual(0);
      done();
    });
  }, 15000);

  test("should unsubscribe from level2 updates", () => {
    client.unsubscribeLevel2Updates(market);
  });

  test("should close connections", done => {
    client.on("closed", done);
    client.close();
  });
});
