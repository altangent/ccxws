const Poloniex = require("./poloniex-client");
jest.mock("winston", () => ({ info: jest.fn() }));

let client;
let market = {
  id: "USDT_BTC",
  base: "BTC",
  quote: "USDT",
};

beforeAll(() => {
  client = new Poloniex();
});

test(
  "should subscribe and emit trade events",
  done => {
    client.subscribeTrades(market);
    client.on("trade", trade => {
      expect(trade.fullId).toMatch("Poloniex:BTC/USDT");
      expect(trade.exchange).toMatch("Poloniex");
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

test("should close connections", done => {
  client.on("closed", done);
  client.close();
});
