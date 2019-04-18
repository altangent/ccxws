const Gemini = require("./gemini-client");
jest.mock("winston", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.retryTimes(3);

let client;
let market1 = {
  id: "btcusd",
  base: "BTC",
  quote: "USD",
};
let market2 = {
  id: "ethusd",
  base: "ETH",
  quote: "USD",
};

describe("GeminiClient", () => {
  beforeAll(() => {
    client = new Gemini();
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

  // run first so we can capture snapshot
  test("should subscribe and emit level2 snapshot and updates", done => {
    let hasSnapshot = false;
    client.subscribeLevel2Updates(market1);
    client.on("l2snapshot", (snapshot, market) => {
      hasSnapshot = true;
      expect(market).toBeDefined();
      expect(market.id).toMatch(/btcusd|ethusd/);
      expect(snapshot.fullId).toMatch("Gemini:BTC/USD");
      expect(snapshot.exchange).toMatch("Gemini");
      expect(snapshot.base).toMatch("BTC");
      expect(snapshot.quote).toMatch("USD");
      expect(snapshot.sequenceId).toBeGreaterThan(0);
      expect(snapshot.timestampMs).toBeUndefined();
      expect(parseFloat(snapshot.asks[0].price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(snapshot.asks[0].size)).toBeGreaterThanOrEqual(0);
      expect(snapshot.asks[0].count).toBeUndefined();
      expect(parseFloat(snapshot.bids[0].price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(snapshot.bids[0].size)).toBeGreaterThanOrEqual(0);
      expect(snapshot.bids[0].count).toBeUndefined();
    });
    client.on("l2update", (update, market) => {
      expect(market).toBeDefined();
      expect(market.id).toMatch(/btcusd|ethusd/);
      expect(hasSnapshot).toBeTruthy();
      expect(update.fullId).toMatch("Gemini:BTC/USD");
      expect(update.exchange).toMatch("Gemini");
      expect(update.base).toMatch("BTC");
      expect(update.quote).toMatch("USD");
      expect(update.sequenceId).toBeGreaterThan(0);
      expect(update.timestampMs).toBeGreaterThan(1522540800000);
      let point = update.asks[0] || update.bids[0];
      expect(typeof point.price).toBe("string");
      expect(typeof point.size).toBe("string");
      expect(parseFloat(point.price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(point.size)).toBeGreaterThanOrEqual(0);
      expect(point.count).toBeUndefined();
      expect(point.meta.reason).toMatch(/(place|trade|cancel)/);
      expect(parseFloat(point.meta.delta)).toBeDefined();
      done();
    });
  });

  test("should subscribe and emit trade events", done => {
    client.subscribeTrades(market1);
    client.subscribeTrades(market2);
    client.on("trade", (trade, market) => {
      expect(market).toBeDefined();
      expect(market.id).toMatch(/btcusd|ethusd/);
      expect(trade.fullId).toMatch(/Gemini:(BTC|ETH)\/USD/);
      expect(trade.exchange).toMatch("Gemini");
      expect(trade.base).toMatch(/ETH|BTC/);
      expect(trade.quote).toMatch("USD");
      expect(trade.tradeId).toBeGreaterThan(0);
      expect(trade.unix).toBeGreaterThan(1522540800000);
      expect(trade.side).toMatch(/buy|sell/);
      expect(typeof trade.price).toBe("string");
      expect(typeof trade.amount).toBe("string");
      expect(parseFloat(trade.price)).toBeGreaterThan(0);
      expect(parseFloat(trade.amount)).toBeGreaterThan(0);
      done();
    });
  }, 60000);

  test("should unsubscribe from trades", () => {
    client.unsubscribeTrades(market1);
    client.unsubscribeTrades(market2);
  });

  test("should unsubscribe from level2orders", () => {
    client.unsubscribeLevel2Updates(market1);
  });

  test("should close connections", done => {
    client.on("closed", done);
    client.close();
  });
});
