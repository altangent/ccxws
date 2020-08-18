const HuobiBase = require("./huobi-base");

class HuobiKoreaClient extends HuobiBase {
  constructor({ wssPath = "wss://api-cloud.huobi.co.kr/ws", watcherMs } = {}) {
    super({ name: "Huobi Korea", wssPath, watcherMs });
  }
}

module.exports = HuobiKoreaClient;
