/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Level2Point } from "./Level2Point";

export class Level2Snapshot {
    public base: string;
    public quote: string;
    public exchange: string;
    public sequenceId: number;
    public timestampMs: number;
    public asks: Level2Point[];
    public bids: Level2Point[];

    constructor(props) {
        for (const key in props) {
            this[key] = props[key];
        }
    }

    public get marketId() {
        return `${this.base}/${this.quote}`;
    }

    /**
     * @deprecated use Market object (second argument to each event) to determine exchange and trade pair
     */
    public get fullId() {
        return `${this.exchange}:${this.base}/${this.quote}`;
    }
}
