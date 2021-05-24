/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

export class Level3Snapshot {
    public exchange: string;
    public base: string;
    public quote: string;

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
