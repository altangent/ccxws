import { expect } from "chai";
import * as zlib from "../src/ZlibUtils";

describe("unzip", () => {
    it("should process valid unzip operations in order", done => {
        const vals = [];
        const cb = (err, val) => {
            vals.push(val);
            if (vals.length === 5) {
                expect(vals).to.deep.equal([
                    Buffer.from("1"),
                    Buffer.from("2"),
                    Buffer.from("3"),
                    Buffer.from("4"),
                    Buffer.from("5"),
                ]);
                done();
            }
        };
        zlib.unzip(Buffer.from("1f8b0800000000000013330400b7efdc8301000000", "hex"), cb);
        zlib.unzip(Buffer.from("1f8b08000000000000133302000dbed51a01000000", "hex"), cb);
        zlib.unzip(Buffer.from("1f8b08000000000000133306009b8ed26d01000000", "hex"), cb);
        zlib.unzip(Buffer.from("1f8b0800000000000013330100381bb6f301000000", "hex"), cb);
        zlib.unzip(Buffer.from("1f8b0800000000000013330500ae2bb18401000000", "hex"), cb);
    });

    it("should process invalid unzip operations in order", done => {
        const errs = [];
        const cb = err => {
            errs.push(err);
            if (errs.length === 3) done();
        };
        zlib.unzip(Buffer.from("1", "hex"), cb);
        zlib.unzip(Buffer.from("2", "hex"), cb);
        zlib.unzip(Buffer.from("3", "hex"), cb);
    });

    it("should process invalid and valid unzip operations in order", done => {
        const vals = [];
        const cb = (err, val) => {
            vals.push(err || val);
            if (vals.length === 3) {
                expect(vals[0]).to.deep.equal(Buffer.from("1"));
                expect(vals[1]).to.be.instanceOf(Error);
                expect(vals[2]).to.deep.equal(Buffer.from("2"));
                done();
            }
        };
        zlib.unzip(Buffer.from("1f8b0800000000000013330400b7efdc8301000000", "hex"), cb);
        zlib.unzip(Buffer.from("2", "hex"), cb);
        zlib.unzip(Buffer.from("1f8b08000000000000133302000dbed51a01000000", "hex"), cb);
    });
});

describe("inflateRaw", () => {
    it("should process operations in order", done => {
        const vals = [];
        const cb = (err, val) => {
            vals.push(val);
            if (vals.length === 5) {
                expect(vals).to.deep.equal([
                    Buffer.from("1"),
                    Buffer.from("2"),
                    Buffer.from("3"),
                    Buffer.from("4"),
                    Buffer.from("5"),
                ]);
                done();
            }
        };
        zlib.inflateRaw(Buffer.from("330400", "hex"), cb);
        zlib.inflateRaw(Buffer.from("330200", "hex"), cb);
        zlib.inflateRaw(Buffer.from("330600", "hex"), cb);
        zlib.inflateRaw(Buffer.from("330100", "hex"), cb);
        zlib.inflateRaw(Buffer.from("330500", "hex"), cb);
    });
});
