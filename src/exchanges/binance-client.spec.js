const Binance = require("./binance-client");
jest.mock("winston", () => ({ info: jest.fn() }));

let client;
let market = {
  id: "ETHBTC",
  base: "ETH",
  quote: "BTC",
};

beforeAll(() => {
  client = new Binance();
});

test(
  "should subscribe and emit trade events",
  done => {
    client.subscribeTrades(market);
    client.on("trade", trade => {
      expect(trade.fullId).toMatch("Binance:ETH/BTC");
      expect(trade.exchange).toMatch("Binance");
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

test("should subscribe and emit level2 snapshots", done => {
  client.subscribeLevel2Snapshots(market);
  client.on("l2snapshot", snapshot => {
    expect(snapshot.fullId).toMatch("Binance:ETH/BTC");
    expect(snapshot.exchange).toMatch("Binance");
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
    done();
  });
});

test("should subscribe and emit level2 updates", done => {
  client.subscribeLevel2Updates(market);
  client.on("l2update", update => {
    expect(update.fullId).toMatch("Binance:ETH/BTC");
    expect(update.exchange).toMatch("Binance");
    expect(update.base).toMatch("ETH");
    expect(update.quote).toMatch("BTC");
    expect(update.sequenceId).toBeGreaterThan(0);
    expect(update.lastSequenceId).toBeGreaterThan(update.sequenceId);
    expect(parseFloat(update.asks[0].price)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(update.asks[0].size)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(update.bids[0].price)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(update.bids[0].size)).toBeGreaterThanOrEqual(0);
    done();
  });
});

test("should unsubscribe from trades", () => {
  client.unsubscribeTrades(market);
});

test("should unsubscribe from level2 snapshots", () => {
  client.unsubscribeLevel2Snapshots(market);
});

test("should unsubscribe from level2 updates", () => {
  client.unsubscribeLevel2Updates(market);
});

test("should close connections", done => {
  client.on("closed", done);
  client.close();
});
