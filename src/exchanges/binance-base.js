const { CandlePeriod } = require("../enums");

module.exports = {
  candlePeriod,
};

function candlePeriod(p) {
  switch (p) {
    case CandlePeriod._1m:
      return "1m";
    case CandlePeriod._3m:
      return "3m";
    case CandlePeriod._5m:
      return "5m";
    case CandlePeriod._15m:
      return "15m";
    case CandlePeriod._30m:
      return "30m";
    case CandlePeriod._1h:
      return "1h";
    case CandlePeriod._2h:
      return "2h";
    case CandlePeriod._4h:
      return "4h";
    case CandlePeriod._6h:
      return "6h";
    case CandlePeriod._8h:
      return "8h";
    case CandlePeriod._12h:
      return "12h";
    case CandlePeriod._1d:
      return "1d";
    case CandlePeriod._3d:
      return "3d";
    case CandlePeriod._1w:
      return "1w";
    case CandlePeriod._1M:
      return "1M";
  }
}
