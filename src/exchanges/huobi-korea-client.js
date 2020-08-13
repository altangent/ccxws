const HuobiBase = require("./huobi-base");

class HuobiKoreaClient extends HuobiBase {
  constructor() {
    super({ name: "Huobi Korea", wssPath: "wss://api-cloud.huobi.co.kr/ws" });
  }
}

module.exports = HuobiKoreaClient;
