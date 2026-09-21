import { area as turfArea, bboxPolygon, booleanPointInPolygon, buffer, convex, featureCollection, kinks, lineString, point, pointOnFeature, polygon } from "@turf/turf";
import { sha256 } from "./util.mjs";

const AREA_KINDS = new Set(["rectangle", "polygon", "station-anchors", "route-corridor"]);

export function resolveArea(areaConfig) {
  if (!AREA_KINDS.has(areaConfig?.kind)) throw new Error(`Unsupported area kind: ${areaConfig?.kind ?? "missing"}`);
  let shape;
  let anchors = [];
  if (areaConfig.kind === "rectangle") {
    shape = bboxPolygon([areaConfig.west, areaConfig.south, areaConfig.east, areaConfig.north]);
  } else if (areaConfig.kind === "polygon") {
    const ring = closeRing(areaConfig.coordinates);
    shape = polygon([ring]);
    if (kinks(shape).features.length) throw new Error("Area polygon self-intersects");
  } else if (areaConfig.kind === "route-corridor") {
    // A corridor is a one-off shape for a single run: the width is explicit so the area it covers is never implied.
    const waypoints = dedupeConsecutive(areaConfig.waypoints);
    if (waypoints.length < 2) throw new Error("Route corridor needs at least two distinct waypoints");
    shape = buffer(lineString(waypoints), areaConfig.corridorWidthMeters / 2000, { units: "kilometers", steps: 16 });
    if (!shape) throw new Error("Route corridor could not be built");
  } else {
    anchors = areaConfig.anchors;
    const unique = dedupePoints(anchors.map(a => a.point));
    if (unique.length < 3) throw new Error("Area needs at least three unique anchors");
    const hull = convex(featureCollection(unique.map(p => point(p))));
    if (!hull) throw new Error("Area anchors are collinear");
    shape = areaConfig.bufferMeters > 0 ? buffer(hull, areaConfig.bufferMeters / 1000, { units: "kilometers", steps: 16 }) : hull;
  }
  if (!shape || turfArea(shape) <= 0) throw new Error("Area polygon is empty");
  if (turfArea(shape) > 2_000_000_000) throw new Error("Area polygon is implausibly large");
  // A one-off area carries its own ceiling so an accidental country-sized corridor fails closed before any polling.
  const squareKm = turfArea(shape) / 1_000_000;
  if (Number.isFinite(areaConfig.maxAreaSquareKm) && squareKm > areaConfig.maxAreaSquareKm) throw new Error(`Area covers ${squareKm.toFixed(1)} km², above the configured limit of ${areaConfig.maxAreaSquareKm} km²`);
  const coordinates = shape.geometry.coordinates[0];
  return { label: areaConfig.label, polygon: coordinates, areaHash: sha256(coordinates), feature: shape, anchors, squareKm, interiorPoint: interiorPointOf(shape, coordinates), maxStationCount: Number.isFinite(areaConfig.maxStationCount) ? areaConfig.maxStationCount : undefined };
}

// A corridor that loops back on itself buffers into a polygon with a hole, and the centroid of its outer ring can
// land in that hole. The ranking reference point has to be a point that is actually inside the zone.
function interiorPointOf(shape, closedRing) {
  const ring = closedRing.length > 1 && closedRing[0][0] === closedRing.at(-1)[0] && closedRing[0][1] === closedRing.at(-1)[1] ? closedRing.slice(0, -1) : closedRing;
  const centroid = [ring.reduce((sum, value) => sum + value[0], 0) / ring.length, ring.reduce((sum, value) => sum + value[1], 0) / ring.length];
  if (booleanPointInPolygon(point(centroid), shape, { ignoreBoundary: false })) return centroid;
  const fallback = pointOnFeature(shape)?.geometry?.coordinates;
  return Array.isArray(fallback) && fallback.every(Number.isFinite) ? fallback : centroid;
}

export function isInsideArea(coordinate, resolvedArea, { anchorLabels = [], stationLabel } = {}) {
  if (stationLabel && anchorLabels.some(label => samePlace(label, stationLabel))) return true;
  return booleanPointInPolygon(point(coordinate), resolvedArea.feature, { ignoreBoundary: false });
}
export function samePlace(a, b) { const normalize = value => String(value).normalize("NFKC").toLowerCase().replaceAll("ё", "е").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/^(г\s+)?волгоград\s+/u, "").trim(); const aa = normalize(a), bb = normalize(b); return Boolean(aa) && aa === bb; }

export function haversineMeters(a, b) {
  const rad = value => value * Math.PI / 180;
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const lat1 = rad(a[1]);
  const lat2 = rad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function closeRing(coordinates) {
  const ring = dedupeConsecutive(coordinates);
  if (ring.length < 3) throw new Error("Polygon needs at least three points");
  const first = ring[0], last = ring.at(-1);
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
  return ring;
}
function dedupePoints(points) { return [...new Map(points.map(p => [p.join(","), p])).values()]; }
function dedupeConsecutive(points) { return points.filter((p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1]); }
