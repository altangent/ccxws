import { ClientOptions } from "../ClientOptions";
import { HuobiBase } from "./HuobiBase";

export class HuobiKoreaClient extends HuobiBase {
    constructor({ wssPath = "wss://api-cloud.huobi.co.kr/ws", watcherMs }: ClientOptions = {}) {
        super({ name: "Huobi Korea", wssPath, watcherMs });
    }
}
