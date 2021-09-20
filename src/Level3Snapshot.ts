/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Level3Point } from "./Level3Point";

export class Level3Snapshot {
    public exchange: string;
    public base: string;
    public quote: string;
    public sequenceId: number;
    public timestampMs: number;
    public asks: Level3Point[];
    public bids: Level3Point[];

    constructor(props: any) {
        for (const key in props) {
            this[key] = props[key];
        }
    }

    /**
     * @deprecated use Market object (second argument to each event) to determine exchange and trade pair
     */
    public get fullId() {
        return `${this.exchange}:${this.base}/${this.quote}`;
    }
}
