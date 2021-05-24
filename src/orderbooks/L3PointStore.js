const { L2Point } = require("./L2Point");

class L3PointStore {
  constructor() {
    this.points = new Map();
  }

  set(point) {
    this.points.set(point.orderId, point);
  }

  delete(orderId) {
    this.points.delete(orderId);
  }

  has(orderId) {
    this.points.has(orderId);
  }

  clear() {
    this.points.clear();
  }

  snapshot(depth, dir) {
    let sorter;
    switch (dir) {
      case "asc":
        sorter = sortAsc;
        break;
      case "desc":
        sorter = sortDesc;
        break;
      default:
        throw new Error("Unknown sorter");
    }

    return Array.from(aggByPrice(this.points).values()).sort(sorter).slice(0, depth);
  }
}

function aggByPrice(map) {
  // Aggregate the values into price points
  const aggMap = new Map();
  for (const point of map.values()) {
    const price = Number(point.price);
    const size = Number(point.size);

    // If we don't have this price point in the aggregate then we create
    // a new price point with empty values.
    if (!aggMap.has(price)) {
      aggMap.set(price, new L2Point(price, 0, 0));
    }

    // Obtain the price point from the aggregation
    const aggPoint = aggMap.get(price);

    // Update the size
    aggPoint.size += size;
  }

  return aggMap;
}

function sortAsc(a, b) {
  return a.price - b.price;
}

function sortDesc(a, b) {
  return b.price - a.price;
}

module.exports.L3PointStore = L3PointStore;
