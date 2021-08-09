import { BasicClient } from "./BasicClient";
import { BasicMultiClient } from "./BasicMultiClient";
import { SmartWss } from "./SmartWss";
import { Watcher } from "./Watcher";

import { Auction } from "./Auction";
import { BlockTrade } from "./BlockTrade";
import { Candle } from "./Candle";
import { CandlePeriod } from "./CandlePeriod";
import { Level2Point } from "./Level2Point";
import { Level2Snapshot } from "./Level2Snapshots";
import { Level2Update } from "./Level2Update";
import { Level3Point } from "./Level3Point";
import { Level3Snapshot } from "./Level3Snapshot";
import { Level3Update } from "./Level3Update";
import { Ticker } from "./Ticker";
import { Trade } from "./Trade";

import { BiboxClient } from "./exchanges/BiboxClient";
import { BinanceClient } from "./exchanges/BinanceClient";
import { BinanceFuturesCoinmClient } from "./exchanges/BinanceFuturesCoinmClient";
import { BinanceFuturesUsdtmClient } from "./exchanges/BinanceFuturesUsdtmClient";
import { BinanceJeClient } from "./exchanges/BinanceJeClient";
import { BinanceUsClient } from "./exchanges/BinanceUsClient";
import { BitfinexClient } from "./exchanges/BitfinexClient";
import { BitflyerClient } from "./exchanges/BitflyerClient";
import { BithumbClient } from "./exchanges/BithumbClient";
import { BitmexClient } from "./exchanges/BitmexClient";
import { BitstampClient } from "./exchanges/BitstampClient";
import { BittrexClient } from "./exchanges/BittrexClient";
import { CexClient } from "./exchanges/CexClient";
import { CoinbaseProClient } from "./exchanges/CoinbaseProClient";
import { CoinexClient } from "./exchanges/CoinexClient";
import { DeribitClient } from "./exchanges/DeribitClient";
import { DigifinexClient } from "./exchanges/DigifinexClient";
import { ErisXClient } from "./exchanges/ErisxClient";
import { FtxClient } from "./exchanges/FtxClient";
import { FtxUsClient } from "./exchanges/FtxUsClient";
import { GateioClient } from "./exchanges/GateioClient";
import { GeminiClient } from "./exchanges/Geminiclient";
import { HitBtcClient } from "./exchanges/HitBtcClient";
import { HuobiClient } from "./exchanges/HuobiClient";
import { HuobiFuturesClient } from "./exchanges/HuobiFuturesClient";
import { HuobiJapanClient } from "./exchanges/HuobiJapanClient";
import { HuobiKoreaClient } from "./exchanges/HuobiKoreaClient";
import { HuobiSwapsClient } from "./exchanges/HuobiSwapsClient";
import { KrakenClient } from "./exchanges/KrakenClient";
import { KucoinClient } from "./exchanges/KucoinClient";
import { LedgerXClient } from "./exchanges/LedgerXClient";
import { LiquidClient } from "./exchanges/LiquidClient";
import { OkexClient } from "./exchanges/OkexClient";
import { PoloniexClient } from "./exchanges/PoloniexClient";
import { UpbitClient } from "./exchanges/UpbitClient";
import { ZbClient } from "./exchanges/ZbClient";

export {
    //
    // Base clients
    BasicClient,
    BasicMultiClient,
    SmartWss,
    Watcher,
    //
    // Event types
    Auction,
    BlockTrade,
    Candle,
    CandlePeriod,
    Level2Point,
    Level2Snapshot,
    Level2Update,
    Level3Point,
    Level3Snapshot,
    Level3Update,
    Ticker,
    Trade,
    //
    // Clients
    BiboxClient,
    BinanceClient,
    BinanceFuturesCoinmClient,
    BinanceFuturesUsdtmClient,
    BinanceJeClient,
    BinanceUsClient,
    BitfinexClient,
    BitflyerClient,
    BithumbClient,
    BitmexClient,
    BitstampClient,
    BittrexClient,
    CexClient,
    CoinbaseProClient,
    CoinexClient,
    DeribitClient,
    DigifinexClient,
    ErisXClient,
    FtxClient,
    FtxUsClient,
    GateioClient,
    GeminiClient,
    HitBtcClient,
    HuobiClient,
    HuobiFuturesClient,
    HuobiSwapsClient,
    HuobiJapanClient,
    HuobiKoreaClient,
    KucoinClient,
    KrakenClient,
    LedgerXClient,
    LiquidClient,
    OkexClient,
    PoloniexClient,
    UpbitClient,
    ZbClient,
};

/**
 * @deprecated Use named imports instead of default import. Client
 * names have also changed and are now suffixed with `Client`. Deprecation
 * warning added in v0.46.0 and will be removed in a future version.
 */
export default {
    Bibox: BiboxClient,
    Binance: BinanceClient,
    BinanceFuturesCoinM: BinanceFuturesCoinmClient,
    BinanceFuturesUsdtM: BinanceFuturesUsdtmClient,
    BinanceJe: BinanceJeClient,
    BinanceUs: BinanceUsClient,
    Bitfinex: BitfinexClient,
    Bitflyer: BitflyerClient,
    Bithumb: BithumbClient,
    BitMEX: BitmexClient,
    Bitstamp: BitstampClient,
    Bittrex: BittrexClient,
    Cex: CexClient,
    CoinbasePro: CoinbaseProClient,
    Coinex: CoinexClient,
    Deribit: DeribitClient,
    Digifinex: DigifinexClient,
    ErisX: ErisXClient,
    Ftx: FtxClient,
    FtxUs: FtxUsClient,
    Gateio: GateioClient,
    Gemini: GeminiClient,
    HitBTC: HitBtcClient,
    Huobi: HuobiClient,
    HuobiFutures: HuobiFuturesClient,
    HuobiSwaps: HuobiSwapsClient,
    HuobiJapan: HuobiJapanClient,
    HuobiKorea: HuobiKoreaClient,
    Kucoin: KucoinClient,
    Kraken: KrakenClient,
    LedgerX: LedgerXClient,
    Liquid: LiquidClient,
    OKEx: OkexClient,
    Poloniex: PoloniexClient,
    Upbit: UpbitClient,
    Zb: ZbClient,
};
