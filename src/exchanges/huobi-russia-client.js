const HuobiBase = require("./huobi-base");

class HuobiKoreaClient extends HuobiBase {
  constructor() {
    super({ name: "Huobi Russia", wssPath: "wss://www.huobi.com.ru/-/s/hbcloud/ws" });
  }
}

module.exports = HuobiKoreaClient;
