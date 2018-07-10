const HuobiClient = require("./huobi-client");
jest.mock("winston", () => ({ info: jest.fn() }));

let client;
let market = {
  id: "btcusdt",
  base: "BTC",
  quote: "USDT",
};

beforeAll(() => {
  client = new HuobiClient();
});

test("it should support trades", () => {
  expect(client.hasTrades).toBeTruthy();
});

test("it should support level2 snapshots", () => {
  expect(client.hasLevel2Snapshots).toBeTruthy();
});

test("it should not support level2 updates", () => {
  expect(client.hasLevel2Updates).toBeFalsy();
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
      expect(trade.fullId).toMatch("Huobi:BTC/USDT");
      expect(trade.exchange).toMatch("Huobi");
      expect(trade.base).toMatch("BTC");
      expect(trade.quote).toMatch("USDT");
      expect(trade.tradeId).toMatch(/[0-9]{1,}/);
      expect(trade.unix).toBeGreaterThan(1522540800000);
      expect(trade.side).toMatch(/buy|sell/);
      expect(typeof trade.price).toBe("string");
      expect(typeof trade.amount).toBe("string");
      expect(parseFloat(trade.price)).toBeGreaterThan(0);
      expect(parseFloat(trade.amount)).toBeGreaterThan(0);
      done();
    });
  },
  30000
);

test("should subscribe and emit level2 snapshots", done => {
  client.subscribeLevel2Snapshots(market);
  client.on("l2snapshot", snapshot => {
    expect(snapshot.fullId).toMatch("Huobi:BTC/USDT");
    expect(snapshot.exchange).toMatch("Huobi");
    expect(snapshot.base).toMatch("BTC");
    expect(snapshot.quote).toMatch("USDT");
    expect(snapshot.sequenceId).toBeUndefined();
    expect(snapshot.timestampMs).toBeGreaterThan(0);
    expect(parseFloat(snapshot.asks[0].price)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(snapshot.asks[0].size)).toBeGreaterThanOrEqual(0);
    expect(snapshot.asks[0].count).toBeUndefined();
    expect(parseFloat(snapshot.bids[0].price)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(snapshot.bids[0].size)).toBeGreaterThanOrEqual(0);
    expect(snapshot.bids[0].count).toBeUndefined();
    done();
  });
});

test("should unsubscribe trades", () => {
  client.unsubscribeTrades(market);
});

test("should unsubscribe level2 snapshots", () => {
  client.unsubscribeLevel2Snapshots(market);
});

test("should close connections", done => {
  client.on("closed", done);
  client.close();
});
