const crypto = require("crypto");

module.exports = {
  hs256,
};

function base64Encode(value) {
  let buffer;
  if (Buffer.isBuffer(value)) {
    buffer = value;
  } else if (typeof value === "object") {
    buffer = Buffer.from(JSON.stringify(value));
  } else if (typeof value === "string") {
    buffer = Buffer.from(value);
  }
  return buffer.toString("base64");
}

function base64UrlEncode(value) {
  return base64Encode(value)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function hmacSign(algorithm, secret, data) {
  const hmac = crypto.createHmac(algorithm, secret);
  hmac.update(data);
  return hmac.digest();
}

function hs256(payload, secret) {
  const encHeader = base64UrlEncode({ alg: "HS256", typ: "JWT" });
  const encPayload = base64UrlEncode(payload);
  const sig = hmacSign("sha256", secret, encHeader + "." + encPayload);
  const encSig = base64UrlEncode(sig);
  return encHeader + "." + encPayload + "." + encSig;
}
