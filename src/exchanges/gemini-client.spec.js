const Gemini = require("./gemini-client");
jest.mock("winston", () => ({ info: jest.fn() }));

let client;
let market1 = {
  id: "btcusd",
  base: "BTC",
  quote: "USD",
};
let market2 = {
  id: "ethusd",
  base: "ETH",
  quote: "USD",
};

beforeAll(() => {
  client = new Gemini();
});

test(
  "should subscribe and emit trade events",
  done => {
    client.subscribeTrades(market1);
    client.subscribeTrades(market2);
    client.on("trade", trade => {
      //expect(trade.fullId).toMatch("Gemini:BTC/USD");
      expect(trade.exchange).toMatch("Gemini");
      //expect(trade.base).toMatch("BTC");
      expect(trade.quote).toMatch("USD");
      expect(trade.tradeId).toBeGreaterThan(0);
      expect(trade.unix).toBeGreaterThan(1522540800);
      expect(trade.price).toBeGreaterThan(0);
      expect(trade.amount).toBeDefined();
      done();
    });
  },
  60000
);

test("should unsubscribe", () => {
  client.unsubscribeTrades(market1);
});

test("should close connections", done => {
  client.on("closed", done);
  client.close();
});
