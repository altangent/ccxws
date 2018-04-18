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

test("should unsubscribe", () => {
  client.unsubscribeTrades(market);
});

test("should close connections", done => {
  client.on("closed", done);
  client.close();
});
