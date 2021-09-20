import { expect } from "chai";
import { Trade } from "../src/Trade";

describe("Trade", () => {
    it("marketId should be base + quote", () => {
        const t = new Trade({ base: "BTC", quote: "USD" });
        expect(t.marketId).to.equal("BTC/USD");
    });

    it("fullId should be exchange + base + quote", () => {
        const t = new Trade({ exchange: "GDAX", base: "BTC", quote: "USD" });
        expect(t.fullId).to.equal("GDAX:BTC/USD");
    });
});
