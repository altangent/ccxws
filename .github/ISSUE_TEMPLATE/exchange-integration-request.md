---
name: Exchange integration request
about: Suggest addition of an exchange

---

Please provide as much information as possible to make the addition of the exchange easier:

**Exchange Name**
Provide the name of the exchange

**Exchange URL**
Provide the URL to the exchange

**Exchange API URL**
Provide the URL for the documentation of the exchange's realtime API

**Describe the technology used by the exchange use for realtime updates?**
Websockets/JSON RPC/Pusher/Socket.io/Signalr/etc

**Does each market require it own connection?**
Yes
No
Unsure

**Describe how subscriptions occur**
IE: some exchange subscribe to markets via the connection URL.  Other exchanges allow subscriptions once a connection has been established. More information will help us determine how client needs to be implemented.


**Can you subscribe to tickers?**
Yes, each market has its own ticker feed
Yes, there is a unified ticker feed for all market
No
Unsure
Other (please provide more information)

**Can you subscribe to candles?**
Yes
No
Unsure
Other (please provide more information)

**Are trades and order book updates provided in a unified market feed?**
Yes (provide more detail on how the market feed operates.  IE: Poloniex uses a single feed per market to broadcast trades and order book updates. When the feed is established, the order book snapshot is broadcast first.)
No
Unsure

**Can you subscribe to trades?**
Yes, there is a feed for trades (Ex: Binance)
Yes, trades are broadcast as part of a unified market feed (Ex: Poloniex, Gemini)
No
Unsure (please provide more information)

**Can you subscribe to level2 snapshots?**
Yes, there is a feed for level2 snapshots (Ex: Binance)
Yes, level2 snapshots are broadcast as part of an unified market feed (Ex: Poloniex, Gemini)
Yes, a level2 snapshot is broadcast at the start of level2 update subscription (Ex: HitBTC)
Yes, a level2 snapshot can be manually requested (Ex: Bittrex)
No
Unsure (please provide more information)

**Can you subscribe to level2 updates?**
Yes, there is a feed for level2 updates (Ex: Bitfinex)
Yes, level2 updates are broadcast as part of an unified market feed (Ex: Poloniex, Gemini)
No
Unsure (please provide more information)

**Can you subscribe to level3 snapshots?**
Yes, there is a feed for level3 snapshots
Yes, level3 snapshots are broadcast as part of an unified market feed
Yes, a level3 snapshot is broadcast at the start of level2 update subscription
Yes, a level3 snapshot can be manually requested
No
Unsure (please provide more information)

**Can you subscribe to level3 updates?**
Yes, there is a feed for level3 updates
Yes, level3 updates are broadcast as part of an unified market feed (Ex: Poloniex, Gemini)
No
Unsure (please provide more information)
