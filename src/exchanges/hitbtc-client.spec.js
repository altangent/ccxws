const HitBTC = require("./hitbtc-client");
jest.mock("winston", () => ({ info: jest.fn() }));

let client;
let market = {
  id: "ETHBTC",
  base: "ETH",
  quote: "BTC",
};

beforeAll(() => {
  client = new HitBTC();
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
  "should subscribe and emit trade events",
  done => {
    client.subscribeTrades(market);
    client.on("trade", trade => {
      expect(trade.fullId).toMatch("HitBTC:ETH/BTC");
      expect(trade.exchange).toMatch("HitBTC");
      expect(trade.base).toMatch("ETH");
      expect(trade.quote).toMatch("BTC");
      expect(trade.tradeId).toBeGreaterThan(0);
      expect(trade.unix).toBeGreaterThan(1522540800);
      expect(trade.price).toBeGreaterThan(0);
      expect(trade.amount).toBeDefined();
      done();
    });
  },
  30000
);

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
