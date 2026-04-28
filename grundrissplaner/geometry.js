export function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function nearlyEqual(a, b, eps = 0.0001) {
  return Math.abs(a - b) <= eps;
}

export function snap(value, step) {
  return Math.round(value / step) * step;
}

export function snapPoint(point, gridSize) {
  return {
    x: snap(point.x, gridSize),
    y: snap(point.y, gridSize)
  };
}

export function metersToPixels(m, scale) {
  return m * scale;
}

export function pixelsToMeters(px, scale) {
  return px / scale;
}

export function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  };
}

export function normalize(v) {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}

export function perpendicular(v) {
  return { x: -v.y, y: v.x };
}

export function pointToSegmentDistance(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const abLenSq = abx * abx + aby * aby;
  let t = 0;
  if (abLenSq > 0) {
    t = (apx * abx + apy * aby) / abLenSq;
    t = Math.max(0, Math.min(1, t));
  }
  const proj = { x: a.x + abx * t, y: a.y + aby * t };
  return {
    distance: Math.hypot(p.x - proj.x, p.y - proj.y),
    point: proj,
    t
  };
}

export function polygonArea(points) {
  if (!points || points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function polygonCentroid(points) {
  if (!points || points.length === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
}

export function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isAxisAligned(a, b, eps = 0.0001) {
  return nearlyEqual(a.x, b.x, eps) || nearlyEqual(a.y, b.y, eps);
}

export function orthogonalize(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: end.x, y: start.y };
  }
  return { x: start.x, y: end.y };
}

export function wallPolygon(start, end, thickness) {
  const dir = normalize({ x: end.x - start.x, y: end.y - start.y });
  const n = perpendicular(dir);
  const half = thickness / 2;
  return [
    { x: start.x + n.x * half, y: start.y + n.y * half },
    { x: end.x + n.x * half, y: end.y + n.y * half },
    { x: end.x - n.x * half, y: end.y - n.y * half },
    { x: start.x - n.x * half, y: start.y - n.y * half }
  ];
}

// Einfache Raumerkennung für orthogonale Grundrisse
export function buildOrthogonalRoomsFromWalls(walls) {
  if (walls.length < 4) return [];

  const eps = 0.01;
  const nodes = new Map();
  const edges = [];

  function nodeKey(p) {
    const rx = Math.round(p.x / eps) * eps;
    const ry = Math.round(p.y / eps) * eps;
    return `${rx.toFixed(4)}|${ry.toFixed(4)}`;
  }

  function addNode(p) {
    const k = nodeKey(p);
    if (!nodes.has(k)) nodes.set(k, { x: p.x, y: p.y, id: k });
    return k;
  }

  for (const wall of walls) {
    const a = addNode(wall.start);
    const b = addNode(wall.end);
    if (a !== b) {
      edges.push([a, b]);
    }
  }

  const adj = new Map();
  for (const [k] of nodes) adj.set(k, new Set());
  for (const [a, b] of edges) {
    adj.get(a).add(b);
    adj.get(b).add(a);
  }

  const rooms = [];
  const visited = new Set();

  function tryRect(startKey) {
    const n0 = nodes.get(startKey);
    const neighbors0 = [...adj.get(startKey)];

    for (const n1key of neighbors0) {
      const n1 = nodes.get(n1key);
      // Suche eine horizontale Kante
      if (!nearlyEqual(n0.y, n1.y)) continue;
      const dir = n1.x > n0.x ? 1 : -1;

      for (const n3key of neighbors0) {
        if (n3key === n1key) continue;
        const n3 = nodes.get(n3key);
        // Suche eine vertikale Kante
        if (!nearlyEqual(n0.x, n3.x)) continue;
        const dir2 = n3.y > n0.y ? 1 : -1;

        // Erwarteter 4. Knoten
        const n2x = n1.x;
        const n2y = n3.y;
        const n2key = nodeKey({ x: n2x, y: n2y });
        if (!nodes.has(n2key)) continue;
        if (!adj.get(n1key).has(n2key)) continue;
        if (!adj.get(n3key).has(n2key)) continue;

        const poly = [n0, n1, nodes.get(n2key), n3];
        const area = polygonArea(poly);
        if (area < 0.01) continue;

        const sortedKeys = [startKey, n1key, n2key, n3key].sort().join("|");
        if (visited.has(sortedKeys)) continue;
        visited.add(sortedKeys);

        rooms.push({
          polygon: poly,
          centroid: polygonCentroid(poly),
          area
        });
      }
    }
  }

  for (const [k] of nodes) {
    tryRect(k);
  }

  return rooms.filter(r => r.area > 0.01);
}
