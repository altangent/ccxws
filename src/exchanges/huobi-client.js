const HuobiBase = require("./huobi-base");

class HuobiClient extends HuobiBase {
  constructor() {
    super({ name: "Huobi", wssPath: "wss://api.huobi.pro/ws" });
  }
}

module.exports = HuobiClient;
