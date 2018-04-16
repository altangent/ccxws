const GDAX = require("./gdax-client");
jest.mock("winston", () => ({ info: jest.fn() }));

let client;
let market = {
  id: "BTC-USD",
  base: "BTC",
  quote: "USD",
};

beforeAll(() => {
  client = new GDAX();
});

test(
  "should subscribe and emit trade events",
  done => {
    client.subscribeTrades(market);
    client.on("trade", trade => {
      expect(trade.fullId).toMatch("GDAX:BTC/USD");
      expect(trade.exchange).toMatch("GDAX");
      expect(trade.base).toMatch("BTC");
      expect(trade.quote).toMatch("USD");
      expect(trade.tradeId).toBeGreaterThan(0);
      expect(trade.unix).toBeGreaterThan(1522540800);
      expect(trade.price).toBeGreaterThan(0);
      expect(trade.amount).toBeDefined();
      done();
    });
  },
  30000
);

test("should close connections", done => {
  client.on("closed", done);
  client.close();
});
