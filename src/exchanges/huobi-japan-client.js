const HuobiBase = require("./huobi-base");

class HuobiJapanClient extends HuobiBase {
  constructor() {
    super({ name: "Huobi Japan", wssPath: "wss://api-cloud.huobi.co.jp/ws" });
  }
}

module.exports = HuobiJapanClient;
