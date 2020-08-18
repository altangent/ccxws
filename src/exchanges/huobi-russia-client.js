const HuobiBase = require("./huobi-base");

class HuobiKoreaClient extends HuobiBase {
  constructor({ wssPath = "wss://www.huobi.com.ru/-/s/hbcloud/ws", watcherMs } = {}) {
    super({ name: "Huobi Russia", wssPath, watcherMs });
  }
}

module.exports = HuobiKoreaClient;
