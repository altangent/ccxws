const BitFlyerClient = require("./bitflyer-client");
jest.mock("winston", () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

let client;
let market = {
  id: "BTC_JPY",
  base: "BTC",
  quote: "JPY",
};

beforeAll(() => {
  client = new BitFlyerClient();
});

test(
  "should subscribe and emit trade events",
  done => {
    client.subscribeTrades(market);
    client.on("trade", trade => {
      expect(trade.fullId).toMatch("BitFlyer:BTC/JPY");
      expect(trade.exchange).toMatch("BitFlyer");
      expect(trade.base).toMatch("BTC");
      expect(trade.quote).toMatch("JPY");
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
