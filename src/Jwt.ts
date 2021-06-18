import { createHmac } from "crypto";

function base64Encode(value: Buffer | string | any): string {
    let buffer: Buffer;
    if (Buffer.isBuffer(value)) {
        buffer = value;
    } else if (typeof value === "object") {
        buffer = Buffer.from(JSON.stringify(value));
    } else if (typeof value === "string") {
        buffer = Buffer.from(value);
    }
    return buffer.toString("base64");
}

function base64UrlEncode(value: Buffer | string | any): string {
    return base64Encode(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function hmacSign(algorithm: string, secret: string, data: string): Buffer {
    const hmac = createHmac(algorithm, secret);
    hmac.update(data);
    return hmac.digest();
}

export function hs256(payload: any, secret: string): string {
    const encHeader = base64UrlEncode({ alg: "HS256", typ: "JWT" });
    const encPayload = base64UrlEncode(payload);
    const sig = hmacSign("sha256", secret, encHeader + "." + encPayload);
    const encSig = base64UrlEncode(sig);
    return encHeader + "." + encPayload + "." + encSig;
}
