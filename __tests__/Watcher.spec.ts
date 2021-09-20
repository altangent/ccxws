import { expect } from "chai";
import sinon from "sinon";
import { EventEmitter } from "events";
import { Watcher } from "../src/Watcher";

class MockClient extends EventEmitter {
    public reconnect: sinon.SinonStub<any[], any>;
    constructor() {
        super();
        this.reconnect = sinon.stub();
    }
}

function wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

describe("Watcher", () => {
    let sut;
    let client;

    before(() => {
        client = new MockClient();
        sut = new Watcher(client, 100);
        sinon.spy(sut, "stop");
    });

    describe("start", () => {
        before(() => {
            sut.start();
        });
        it("should trigger a stop", () => {
            expect(sut.stop.callCount).to.equal(1);
        });
        it("should start the interval", () => {
            expect(sut._intervalHandle).to.not.be.undefined;
        });
    });

    describe("stop", () => {
        before(() => {
            sut.stop();
        });
        it("should clear the interval", () => {
            expect(sut._intervalHandle).to.be.undefined;
        });
    });

    describe("on messages", () => {
        beforeEach(() => {
            sut._lastMessage = undefined;
        });
        it("other should not mark", () => {
            client.emit("other");
            expect(sut._lastMessage).to.be.undefined;
        });
        it("ticker should mark", () => {
            client.emit("ticker");
            expect(sut._lastMessage).to.not.be.undefined;
        });
        it("trade should mark", () => {
            client.emit("trade");
            expect(sut._lastMessage).to.not.be.undefined;
        });
        it("l2snapshot should mark", () => {
            client.emit("l2snapshot");
            expect(sut._lastMessage).to.not.be.undefined;
        });
        it("l2update should mark", () => {
            client.emit("l2update");
            expect(sut._lastMessage).to.not.be.undefined;
        });
        it("l3snapshot should mark", () => {
            client.emit("l3snapshot");
            expect(sut._lastMessage).to.not.be.undefined;
        });
        it("l3update should mark", () => {
            client.emit("l3update");
            expect(sut._lastMessage).to.not.be.undefined;
        });
    });

    describe("on expire", () => {
        before(() => {
            sut.start();
        });
        it("it should call reconnect on the client", async () => {
            await wait(500);
            expect(client.reconnect.callCount).to.be.gt(0);
        });
    });
}).retries(3);
