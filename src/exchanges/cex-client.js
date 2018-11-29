const crypto = require("crypto");
const BasicClient = require("../basic-client");

class CexClient extends BasicClient {
  constructor(auth) {
    super("wss://ws.cex.io/ws", "CEX");
    this.auth = auth;
    this.hasAuthorize = true;
    this.hasTickers = true;
  }

  createSignature(timestamp, apiKey, apiSecret) {
    var hmac = crypto.createHmac("sha256", apiSecret);
    hmac.update(timestamp + apiKey);
    return hmac.digest("hex");
  }

  createAuthToken(apiKey, apiSecret) {
    var timestamp = Math.floor(Date.now() / 1000); // Note: java and javascript timestamp presented in miliseconds
    return {
      key: apiKey,
      signature: this.createSignature(timestamp, apiKey, apiSecret),
      timestamp: timestamp,
    };
  }

  _sendSubTicker() {
    this._wss.send(
      JSON.stringify({
        e: "auth",
        auth: this.createAuthToken(this.auth.apiKey, this.auth.apiSecret),
      })
    );
  }

  // _auth() {
  //   console.log("entry auth");
  //   console.log(this.auth);
  //   this._wss.send(
  //     JSON.stringify({
  //       e: "auth",
  //       auth: this.auth,
  //     })
  //   );
  // }

  _sendUnsubTicker() {}

  _onMessage(raw) {
    let message = JSON.parse(raw);
    let { e, action } = message;

    console.log(raw);

    if (e === "connected") {
      //this._auth();
    }

    if (e === "tick") {
      //let ticker = this._constructTicker(params[0][marketId], market);
      //this.emit("ticker", ticker);
      return;
    }
  }
}

module.exports = CexClient;
