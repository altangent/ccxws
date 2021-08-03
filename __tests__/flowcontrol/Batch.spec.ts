import { expect } from "chai";
import sinon from "sinon";
import { batch } from "../../src/flowcontrol/Batch";

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

describe("batch", () => {
    describe("small batch size", () => {
        let fn;
        let sut;

        beforeEach(() => {
            const batchSize = 2;
            const delayMs = 50;
            fn = sinon.stub();
            sut = batch(fn, batchSize, delayMs);
        });

        it("groups calls within timeout period", async () => {
            sut(1);
            await wait(10);

            sut(2);
            await wait(10);

            sut(3);
            await wait(100);

            expect(fn.callCount).to.equal(2);
            expect(fn.args[0][0]).to.deep.equal([[1], [2]]);
            expect(fn.args[1][0]).to.deep.equal([[3]]);
        });

        it("groups calls within debounce periods", async () => {
            sut(1);
            await wait(100);

            sut(2);
            await wait(100);

            sut(3);
            await wait(100);

            expect(fn.callCount).to.equal(3);
            expect(fn.args[0][0]).to.deep.equal([[1]]);
            expect(fn.args[1][0]).to.deep.equal([[2]]);
            expect(fn.args[2][0]).to.deep.equal([[3]]);
        });

        it("can reset pending executions", async () => {
            sut(1);
            sut.cancel();

            await wait(100);
            expect(fn.callCount).to.equal(0);
        });
    });

    describe("large batch size", () => {
        let fn;
        let sut;

        beforeEach(() => {
            const batchSize = 100;
            const delayMs = 50;
            fn = sinon.stub();
            sut = batch(fn, batchSize, delayMs);
        });

        it("groups calls within timeout period", async () => {
            sut(1);
            await wait(10);

            sut(2);
            await wait(10);

            sut(3);
            await wait(100);

            expect(fn.callCount).to.equal(1);
            expect(fn.args[0][0]).to.deep.equal([[1], [2], [3]]);
        });

        it("groups calls within debounce periods", async () => {
            sut(1);
            await wait(100);

            sut(2);
            await wait(100);

            sut(3);
            await wait(100);

            expect(fn.callCount).to.equal(3);
            expect(fn.args[0][0]).to.deep.equal([[1]]);
            expect(fn.args[1][0]).to.deep.equal([[2]]);
            expect(fn.args[2][0]).to.deep.equal([[3]]);
        });

        it("can reset pending executions", async () => {
            sut(1);
            sut.cancel();

            await wait(100);
            expect(fn.callCount).to.equal(0);
        });
    });
});
