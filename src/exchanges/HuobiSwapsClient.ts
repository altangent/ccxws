import { ClientOptions } from "../ClientOptions";
import { HuobiBase } from "./HuobiBase";

export class HuobiSwapsClient extends HuobiBase {
    constructor({ wssPath = "wss://api.hbdm.com/swap-ws", watcherMs }: ClientOptions = {}) {
        super({ name: "Huobi Swaps", wssPath, watcherMs });
        this.hasLevel2Updates = true;
    }
}
