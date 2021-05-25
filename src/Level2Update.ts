/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

export class Level2Update {
    public base: string;
    public quote: string;
    public exchange: string;

    constructor(props: any) {
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