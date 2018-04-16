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

test("should close connections", done => {
  client.on("closed", done);
  client.close();
});
