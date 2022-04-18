import { expect } from "chai";
import sinon from "sinon";
import { throttle } from "../../src/flowcontrol/Throttle";

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe("throttle", () => {
    it("all at once", async () => {
        const fn = sinon.stub();
        const sut = throttle(fn, 10);

        sut(1);
        sut(2);
        sut(3);

        expect(fn.callCount).to.equal(1);

        await wait(200);

        expect(fn.callCount).to.equal(3);
        expect(fn.args[0][0]).to.equal(1);
        expect(fn.args[1][0]).to.equal(2);
        expect(fn.args[2][0]).to.equal(3);
    });

    it("delayed", async () => {
        const fn = sinon.stub();
        const sut = throttle(fn, 100);

        sut(1);
        expect(fn.callCount).to.equal(1);
        await wait(10);

        sut(2);
        expect(fn.callCount).to.equal(1);
        await wait(100);

        sut(3);
        await wait(300);

        expect(fn.callCount).to.equal(3);
        expect(fn.args[0][0]).to.equal(1);
        expect(fn.args[1][0]).to.equal(2);
        expect(fn.args[2][0]).to.equal(3);
    });
});
