# FAQs

#### What is the format for markets?

The format for markets requires:

- `id`:`string` remote identifier used by the exchange
- `base`:`string` - base symbol for the market
- `quote`:`string` - quote symbol fro the market
- `type`:`string` - type of market (spot/futures/option/swap)

```javascript
{
  id: "BTCUSDT"
  base: "BTC"
  quote: "USDT",
  type: "spot"
}
```

#### How can I obtain markets for an exchange?

You can load markets in several ways:

1. Load the markets from the exchanges REST API and parse them into the format required by CCXWS
2. Load markets from your own database into the format required by CCXWS
3. Use `CCXT` to load markets

#### When I connect to an exchange I receive no data, what is wrong?

Ensure you are using the correct market format.

#### How do I maintain an Level 2 order book?

This is a complex question and varies by each exchange. The two basic methods are `snapshots`
and `updates`. A `snapshot` provides an order book at a particular point in time and includes bids
and asks up to a certain depth (for example 10, 50, or 100 asks and bids).

An `update` usually starts with a `snapshot` and then provides incremental updates to the order book.
These updates include insertions, updates, and deletions. Usually with update streams, the point provided
includes the absolute volume not the delta. This means you can replace a price point with the new size
provided in the stream. Typically deletions have zero size for the price point, indicating you can
remove the price point.

Some exchanges also include sequence identifiers to help you identify when you may have missed a message.
In the event that you miss a message, you should reconnect the stream.

#### Will CCXWS include order books?

Yes! We are working on prototype order books and have implemented them for several exchanges.
These can be found in `src/orderbooks` folder. Once we have finalized some of the data structures
and patterns, we will be implementing full support for other exchanges.

#### Are ticker streams updated with each trade or more frequently?

This depends on the exchange. Some exchanges will provide periodic ticker updates including top
of book updates others will only update the ticker with each tick of the market.
