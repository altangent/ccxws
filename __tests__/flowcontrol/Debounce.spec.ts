import { expect } from "chai";
import sinon from "sinon";
import { debounce } from "../../src/flowcontrol/Debounce";

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

describe("debounce", () => {
    let fn;
    let sut;

    beforeEach(() => {
        const debounceMs = 50;
        fn = sinon.stub();
        sut = debounce(fn, debounceMs);
    });

    it("groups calls within timeout period", async () => {
        sut(1);
        await wait(10);

        sut(2);
        await wait(10);

        sut(3);
        await wait(100);

        expect(fn.callCount).to.equal(1);
        expect(fn.args[0][0]).to.deep.equal(3);
    });

    it("groups calls within debounce periods", async () => {
        sut(1);
        await wait(100);

        sut(2);
        await wait(100);

        sut(3);
        await wait(100);

        expect(fn.callCount).to.equal(3);
        expect(fn.args[0][0]).to.deep.equal(1);
        expect(fn.args[1][0]).to.deep.equal(2);
        expect(fn.args[2][0]).to.deep.equal(3);
    });

    it("can cancel pending executions", async () => {
        sut(1);
        sut.cancel();

        await wait(100);
        expect(fn.callCount).to.equal(0);
    });
});
