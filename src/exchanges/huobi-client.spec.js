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

test(
  "should subscribe and emit trade events",
  done => {
    client.subscribeTrades(market);
    client.on("trade", trade => {
      expect(trade.fullId).toMatch("Huobi:BTC/USDT");
      expect(trade.exchange).toMatch("Huobi");
      expect(trade.base).toMatch("BTC");
      expect(trade.quote).toMatch("USDT");
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
