const Bitstamp = require("./bitstamp-client");
jest.mock("winston", () => ({ info: jest.fn() }));

let client;
let market = {
  id: "btcusd",
  base: "BTC",
  quote: "USD",
};

beforeAll(() => {
  client = new Bitstamp();
});

test(
  "should subscribe and emit trade events",
  done => {
    client.subscribeTrades(market);
    client.on("trade", trade => {
      expect(trade.fullId).toMatch("Bitstamp:BTC/USD");
      expect(trade.exchange).toMatch("Bitstamp");
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

test("should unsubscribe", () => {
  client.unsubscribeTrades(market);
});

test("should close connections", done => {
  client.on("closed", done);
  client.close();
});
