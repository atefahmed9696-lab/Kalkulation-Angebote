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
export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}
export function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}
export function scale(v, s) {
  return { x: v.x * s, y: v.y * s };
}
export function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}
export function cross(a, b) {
  return a.x * b.y - a.y * b.x;
}
export function normalize(v) {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}
export function perpendicular(v) {
  return { x: -v.y, y: v.x };
}
export function lineIntersection(p1, p2, p3, p4) {
  const r = sub(p2, p1);
  const s = sub(p4, p3);
  const denom = cross(r, s);
  if (Math.abs(denom) < 1e-9) return null;
  const t = cross(sub(p3, p1), s) / denom;
  return add(p1, scale(r, t));
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
export function orthogonalize(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: end.x, y: start.y };
  }
  return { x: start.x, y: end.y };
}
export function wallPolygon(start, end, thickness) {
  const dir = normalize(sub(end, start));
  const n = perpendicular(dir);
  const half = thickness / 2;
  return [
    add(start, scale(n, half)),
    add(end, scale(n, half)),
    add(end, scale(n, -half)),
    add(start, scale(n, -half))
  ];
}
export function findConnectedWalls(targetWall, allWalls, endpointKey, tolerance = 0.03) {
  const p = targetWall[endpointKey];
  return allWalls.filter(w => {
    if (w.id === targetWall.id) return false;
    return distance(p, w.start) <= tolerance || distance(p, w.end) <= tolerance;
  });
}
export function wallOutlineWithJoins(wall, allWalls) {
  const dir = normalize(sub(wall.end, wall.start));
  const n = perpendicular(dir);
  const half = wall.thickness / 2;
  let startLeft  = add(wall.start, scale(n,  half));
  let endLeft    = add(wall.end,   scale(n,  half));
  let endRight   = add(wall.end,   scale(n, -half));
  let startRight = add(wall.start, scale(n, -half));
  const startJoin = computeJoin(wall, allWalls, "start");
  const endJoin   = computeJoin(wall, allWalls, "end");
  if (startJoin) {
    startLeft  = startJoin.left;
    startRight = startJoin.right;
  }
  if (endJoin) {
    endLeft  = endJoin.left;
    endRight = endJoin.right;
  }
  return [startLeft, endLeft, endRight, startRight];
}

function uniquePoints(points, tolerance = 0.01) {
  const out = [];
  for (const p of points) {
    const exists = out.some(q => distance(p, q) <= tolerance);
    if (!exists) out.push({ x: p.x, y: p.y });
  }
  return out;
}

function splitPointsForWall(wall, allWalls, tolerance = 0.02) {
  const points = [wall.start, wall.end];
  for (const other of allWalls) {
    if (other.id === wall.id) continue;
    const hit = lineIntersection(wall.start, wall.end, other.start, other.end);
    if (!hit) continue;
    const onThis = pointToSegmentDistance(hit, wall.start, wall.end);
    const onOther = pointToSegmentDistance(hit, other.start, other.end);
    const interiorThis = onThis.t > 0.02 && onThis.t < 0.98;
    const interiorOther = onOther.t > 0.02 && onOther.t < 0.98;
    if (!interiorThis || !interiorOther) continue;
    if (onThis.distance <= tolerance && onOther.distance <= tolerance) {
      points.push(hit);
    }
  }
  return uniquePoints(points, tolerance);
}

export function buildRenderableWalls(walls) {
  const segments = [];
  for (const wall of walls) {
    const points = splitPointsForWall(wall, walls);
    const sorted = points.sort((a, b) => distance(wall.start, a) - distance(wall.start, b));
    for (let i = 0; i < sorted.length - 1; i++) {
      const start = sorted[i];
      const end = sorted[i + 1];
      if (distance(start, end) <= 0.01) continue;
      segments.push({
        ...wall,
        id: `${wall.id}__seg_${i}`,
        sourceWallId: wall.id,
        start: { x: start.x, y: start.y },
        end: { x: end.x, y: end.y }
      });
    }
  }
  return segments;
}
function computeJoin(wall, allWalls, endpointKey) {
  const connected = findConnectedWalls(wall, allWalls, endpointKey, 0.03);
  if (!connected.length) return null;
  const node = wall[endpointKey];
  const dir  = normalize(sub(wall.end, wall.start));
  const n    = perpendicular(dir);
  const half = wall.thickness / 2;
  let left  = add(node, scale(n,  half));
  let right = add(node, scale(n, -half));
  const selfLineLeftEnd  = add(left,  dir);
  const selfLineRightEnd = add(right, dir);
  for (const other of connected) {
    const sameAtStart = distance(node, other.start) <= 0.03;
    const otherNode = sameAtStart ? other.start : other.end;
    const otherFar  = sameAtStart ? other.end   : other.start;
    const otherDir  = normalize(sub(otherFar, otherNode));
    const otherN    = perpendicular(otherDir);
    const otherHalf = other.thickness / 2;
    const otherLeftA  = add(otherNode, scale(otherN,  otherHalf));
    const otherLeftB  = add(otherFar,  scale(otherN,  otherHalf));
    const otherRightA = add(otherNode, scale(otherN, -otherHalf));
    const otherRightB = add(otherFar,  scale(otherN, -otherHalf));
    const hitLeft  = lineIntersection(left,  selfLineLeftEnd,  otherLeftA,  otherLeftB);
    const hitRight = lineIntersection(right, selfLineRightEnd, otherRightA, otherRightB);
    if (hitLeft)  left  = hitLeft;
    if (hitRight) right = hitRight;
  }
  return { left, right };
}
export function rectFromBounds(minX, minY, maxX, maxY) {
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY }
  ];
}

function key2(n) {
  return Number(n).toFixed(4);
}

function pointKey(p) {
  return `${key2(p.x)}|${key2(p.y)}`;
}
export function stableRoomKey(room) {
  const minX = Math.min(...room.polygon.map(p => p.x)).toFixed(2);
  const minY = Math.min(...room.polygon.map(p => p.y)).toFixed(2);
  const maxX = Math.max(...room.polygon.map(p => p.x)).toFixed(2);
  const maxY = Math.max(...room.polygon.map(p => p.y)).toFixed(2);
  return `${minX}_${minY}_${maxX}_${maxY}`;
}
export function snapToExistingEndpoints(point, walls, tolerance = 0.25) {
  let best = null;
  for (const wall of walls) {
    for (const endpoint of [wall.start, wall.end]) {
      const d = distance(point, endpoint);
      if (d <= tolerance && (!best || d < best.distance)) {
        best = { point: { ...endpoint }, distance: d };
      }
    }
  }
  return best ? best.point : point;
}
export function snapToWallMidpoints(point, walls, tolerance = 0.25) {
  let best = null;
  for (const wall of walls) {
    const mid = midpoint(wall.start, wall.end);
    const d = distance(point, mid);
    if (d <= tolerance && (!best || d < best.distance)) {
      best = { point: mid, distance: d };
    }
  }
  return best ? best.point : point;
}
export function snapToAxis(point, reference, tolerance = 0.2) {
  const out = { ...point };
  if (Math.abs(point.x - reference.x) <= tolerance) out.x = reference.x;
  if (Math.abs(point.y - reference.y) <= tolerance) out.y = reference.y;
  return out;
}
export function projectPointToWall(point, wall) {
  return pointToSegmentDistance(point, wall.start, wall.end);
}
export function snapToObjectEdges(point, objects, tolerance = 0.25) {
  let best = null;
  for (const obj of objects) {
    const left   = obj.x - obj.width  / 2;
    const right  = obj.x + obj.width  / 2;
    const top    = obj.y - obj.height / 2;
    const bottom = obj.y + obj.height / 2;
    const candidates = [
      { x: left,    y: point.y },
      { x: right,   y: point.y },
      { x: point.x, y: top    },
      { x: point.x, y: bottom }
    ];
    for (const c of candidates) {
      const d = distance(point, c);
      if (d <= tolerance && (!best || d < best.distance)) {
        best = { point: c, distance: d };
      }
    }
  }
  return best ? best.point : point;
}
export function smartSnapPoint(rawPoint, walls, gridSize, snapEnabled = true, reference = null, objects = []) {
  let point = { ...rawPoint };
  if (snapEnabled) {
    point = snapPoint(point, gridSize);
  }
  point = snapToExistingEndpoints(point, walls, 0.3);
  point = snapToWallMidpoints(point, walls, 0.2);
  if (objects.length > 0) {
    point = snapToObjectEdges(point, objects, 0.25);
  }
  if (reference) {
    point = snapToAxis(point, reference, 0.25);
  }
  return point;
}
export function smartOrthoSnap(start, rawPoint, walls, gridSize, snapEnabled = true, objects = []) {
  let point = smartSnapPoint(rawPoint, walls, gridSize, snapEnabled, start, objects);
  let ortho = orthogonalize(start, point);
  ortho = snapToExistingEndpoints(ortho, walls, 0.3);
  ortho = snapToWallMidpoints(ortho, walls, 0.2);
  return ortho;
}
export function buildWallNodes(walls, tolerance = 0.02) {
  const nodes = [];
  function addNode(point) {
    for (const node of nodes) {
      if (distance(node, point) <= tolerance) {
        node.x = (node.x + point.x) / 2;
        node.y = (node.y + point.y) / 2;
        return node;
      }
    }
    const n = { x: point.x, y: point.y };
    nodes.push(n);
    return n;
  }
  for (const wall of walls) {
    addNode(wall.start);
    addNode(wall.end);
  }
  return nodes;
}
export function buildOrthogonalRoomsFromWalls(walls) {
  if (!walls.length) return [];
  const xs = new Set();
  const ys = new Set();
  for (const wall of walls) {
    xs.add(key2(wall.start.x));
    xs.add(key2(wall.end.x));
    ys.add(key2(wall.start.y));
    ys.add(key2(wall.end.y));
  }
  const xVals = [...xs].map(Number).sort((a, b) => a - b);
  const yVals = [...ys].map(Number).sort((a, b) => a - b);
  if (xVals.length < 2 || yVals.length < 2) return [];
  const blocked = new Set();
  function edgeKey(a, b) {
    const k1 = pointKey(a);
    const k2 = pointKey(b);
    return k1 < k2 ? `${k1}__${k2}` : `${k2}__${k1}`;
  }
  for (const wall of walls) {
    const vertical   = nearlyEqual(wall.start.x, wall.end.x);
    const horizontal = nearlyEqual(wall.start.y, wall.end.y);
    if (!vertical && !horizontal) continue;
    if (vertical) {
      const x  = wall.start.x;
      const y1 = Math.min(wall.start.y, wall.end.y);
      const y2 = Math.max(wall.start.y, wall.end.y);
      for (let i = 0; i < yVals.length - 1; i++) {
        const ya  = yVals[i];
        const yb  = yVals[i + 1];
        const mid = (ya + yb) / 2;
        if ((mid > y1 + 1e-6 && mid < y2 - 1e-6) || nearlyEqual(mid, y1) || nearlyEqual(mid, y2)) {
          blocked.add(edgeKey({ x, y: ya }, { x, y: yb }));
        }
      }
    }
    if (horizontal) {
      const y  = wall.start.y;
      const x1 = Math.min(wall.start.x, wall.end.x);
      const x2 = Math.max(wall.start.x, wall.end.x);
      for (let i = 0; i < xVals.length - 1; i++) {
        const xa  = xVals[i];
        const xb  = xVals[i + 1];
        const mid = (xa + xb) / 2;
        if ((mid > x1 + 1e-6 && mid < x2 - 1e-6) || nearlyEqual(mid, x1) || nearlyEqual(mid, x2)) {
          blocked.add(edgeKey({ x: xa, y }, { x: xb, y }));
        }
      }
    }
  }
  const cols = xVals.length - 1;
  const rows = yVals.length - 1;
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  const rooms = [];
  function canMoveLeft(cx, cy) {
    return !blocked.has(edgeKey({ x: xVals[cx], y: yVals[cy] }, { x: xVals[cx], y: yVals[cy + 1] }));
  }
  function canMoveRight(cx, cy) {
    return !blocked.has(edgeKey({ x: xVals[cx + 1], y: yVals[cy] }, { x: xVals[cx + 1], y: yVals[cy + 1] }));
  }
  function canMoveUp(cx, cy) {
    return !blocked.has(edgeKey({ x: xVals[cx], y: yVals[cy] }, { x: xVals[cx + 1], y: yVals[cy] }));
  }
  function canMoveDown(cx, cy) {
    return !blocked.has(edgeKey({ x: xVals[cx], y: yVals[cy + 1] }, { x: xVals[cx + 1], y: yVals[cy + 1] }));
  }
  function touchesExterior(component) {
    for (const { cx, cy } of component) {
      if (cx === 0 && canMoveLeft(cx, cy))       return true;
      if (cx === cols - 1 && canMoveRight(cx, cy)) return true;
      if (cy === 0 && canMoveUp(cx, cy))          return true;
      if (cy === rows - 1 && canMoveDown(cx, cy)) return true;
    }
    return false;
  }
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      if (visited[cy][cx]) continue;
      const queue = [{ cx, cy }];
      const component = [];
      visited[cy][cx] = true;
      while (queue.length) {
        const current = queue.shift();
        component.push(current);
        const neighbors = [
          { nx: current.cx - 1, ny: current.cy,     ok: current.cx > 0         && canMoveLeft(current.cx,  current.cy) },
          { nx: current.cx + 1, ny: current.cy,     ok: current.cx < cols - 1  && canMoveRight(current.cx, current.cy) },
          { nx: current.cx,     ny: current.cy - 1, ok: current.cy > 0         && canMoveUp(current.cx,    current.cy) },
          { nx: current.cx,     ny: current.cy + 1, ok: current.cy < rows - 1  && canMoveDown(current.cx,  current.cy) }
        ];
        for (const n of neighbors) {
          if (!n.ok) continue;
          if (!visited[n.ny][n.nx]) {
            visited[n.ny][n.nx] = true;
            queue.push({ cx: n.nx, cy: n.ny });
          }
        }
      }
      if (touchesExterior(component)) continue;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let area = 0;
      for (const cell of component) {
        minX = Math.min(minX, xVals[cell.cx]);
        maxX = Math.max(maxX, xVals[cell.cx + 1]);
        minY = Math.min(minY, yVals[cell.cy]);
        maxY = Math.max(maxY, yVals[cell.cy + 1]);
        area += (xVals[cell.cx + 1] - xVals[cell.cx]) * (yVals[cell.cy + 1] - yVals[cell.cy]);
      }
      const polygon = rectFromBounds(minX, minY, maxX, maxY);
      rooms.push({
        id: `room_${rooms.length + 1}`,
        polygon,
        area,
        centroid: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
        stableKey: stableRoomKey({ polygon })
      });
    }
  }
  return rooms.filter(room => room.area > 0.01);
}
