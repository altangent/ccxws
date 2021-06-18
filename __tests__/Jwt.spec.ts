import { expect } from "chai";
import * as jwt from "../src/Jwt";

describe("JWT", () => {
    describe("hs256", () => {
        it("valid token", () => {
            const payload = {
                loggedInAs: "admin",
                iat: 1422779638,
            };
            const secret = "secretkey";
            const result = jwt.hs256(payload, secret);
            expect(result).to.equal(
                "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsb2dnZWRJbkFzIjoiYWRtaW4iLCJpYXQiOjE0MjI3Nzk2Mzh9.gzSraSYS8EXBxLN_oWnFSRgCzcmJmMjLiuyu5CSpyHI",
            );
        });

        it("valid token", () => {
            const payload = {
                sub: "1234567890",
                name: "John Doe",
                iat: 1516239022,
            };
            const secret = "secret";
            const result = jwt.hs256(payload, secret);
            expect(result).to.equal(
                "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.XbPfbIHMI6arZ3Y922BhjWgQzWXcXNrz0ogtVhfEd2o",
            );
        });
    });
});
