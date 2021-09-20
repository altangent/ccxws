import { ClientOptions } from "../ClientOptions";
import { FtxBaseClient } from "./FtxBase";

export class FtxClient extends FtxBaseClient {
    constructor({ wssPath = "wss://ftx.com/ws", watcherMs }: ClientOptions = {}) {
        super({ name: "FTX", wssPath, watcherMs });
    }
}
