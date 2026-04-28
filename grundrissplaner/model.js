import {
  buildOrthogonalRoomsFromWalls,
  pointToSegmentDistance,
  wallPolygon,
  pointInPolygon
} from "./geometry.js";

let _nextId = 1;
function uid() {
  return `id_${_nextId++}`;
}

const MAX_HISTORY = 50;

export class FloorPlanModel {
  constructor() {
    this.scale        = 80;   // Pixel pro Meter
    this.gridSize     = 0.5;
    this.snapEnabled  = true;
    this.wallThickness = 0.20;

    this.layers = {
      architecture: true,
      electrical:   true,
      sanitary:     true,
      heating:      true,
      drywall:      true,
      furniture:    true
    };

    this.walls    = [];
    this.openings = [];
    this.objects  = [];
    this.rooms    = [];
    this.selected = null;

    // Undo / Redo
    this._history = [];   // gespeicherte Snapshots
    this._future  = [];   // wiederherstellbare Snapshots
  }

  // --- Undo / Redo -----------------------------------------------------------

  _snapshot() {
    return JSON.stringify({
      walls:    this.walls,
      openings: this.openings,
      objects:  this.objects
    });
  }

  _pushHistory() {
    this._history.push(this._snapshot());
    if (this._history.length > MAX_HISTORY) this._history.shift();
    this._future = [];  // Redo-Stack leeren
  }

  undo() {
    if (this._history.length === 0) return false;
    this._future.push(this._snapshot());
    const prev = this._history.pop();
    this._restoreSnapshot(prev);
    return true;
  }

  redo() {
    if (this._future.length === 0) return false;
    this._history.push(this._snapshot());
    const next = this._future.pop();
    this._restoreSnapshot(next);
    return true;
  }

  _restoreSnapshot(json) {
    const data = JSON.parse(json);
    this.walls    = data.walls    ?? [];
    this.openings = data.openings ?? [];
    this.objects  = data.objects  ?? [];
    this.selected = null;
    this.recomputeRooms();
  }

  get canUndo() { return this._history.length > 0; }
  get canRedo()  { return this._future.length > 0; }

  // --- Wände -----------------------------------------------------------------

  addWall(start, end, layer = "architecture") {
    this._pushHistory();
    const wall = {
      type:      "wall",
      id:        uid(),
      layer,
      start:     { ...start },
      end:       { ...end },
      thickness: this.wallThickness
    };
    this.walls.push(wall);
    this.recomputeRooms();
    return wall;
  }

  updateWall(id, props) {
    const wall = this.getWallById(id);
    if (!wall) return;
    this._pushHistory();
    Object.assign(wall, props);
    this.recomputeRooms();
  }

  // --- Öffnungen (Türen / Fenster) ------------------------------------------

  addOpening(type, wallId, positionT, width = 0.9) {
    this._pushHistory();
    const opening = {
      type,
      id:         uid(),
      wallId,
      positionT:  Math.max(0.05, Math.min(0.95, positionT)),
      width,
      height:     type === "door" ? 2.0 : 1.2,
      sillHeight: type === "door" ? 0.0 : 0.9
    };
    this.openings.push(opening);
    return opening;
  }

  updateOpening(id, props) {
    const opening = this.openings.find(o => o.id === id);
    if (!opening) return;
    this._pushHistory();
    Object.assign(opening, props);
    if (opening.positionT !== undefined) {
      opening.positionT = Math.max(0.05, Math.min(0.95, opening.positionT));
    }
  }

  // --- Objekte ---------------------------------------------------------------

  addObject(catalogItem, x, y) {
    this._pushHistory();
    const obj = {
      type:     "object",
      id:       uid(),
      layer:    catalogItem.id === "drywall" || catalogItem.id === "shaftwall"
                  ? "drywall" : catalogItem.id === "radiator" || catalogItem.id === "boiler"
                  ? "heating" : catalogItem.id === "wc" || catalogItem.id === "sink" ||
                    catalogItem.id === "shower" || catalogItem.id === "bathtub"
                  ? "sanitary" : catalogItem.id === "socket" || catalogItem.id === "switch" ||
                    catalogItem.id === "lamp"
                  ? "electrical" : "furniture",
      name:     catalogItem.name,
      symbol:   catalogItem.symbol,
      color:    catalogItem.color,
      x,
      y,
      width:    catalogItem.width,
      height:   catalogItem.height,
      rotation: 0
    };
    this.objects.push(obj);
    return obj;
  }

  updateObject(id, props) {
    const obj = this.objects.find(o => o.id === id);
    if (!obj) return;
    this._pushHistory();
    Object.assign(obj, props);
  }

  // --- Löschen ---------------------------------------------------------------

  deleteSelected() {
    if (!this.selected) return false;
    this._pushHistory();
    const { type, id } = this.selected;
    if (type === "wall") {
      this.walls    = this.walls.filter(w => w.id !== id);
      this.openings = this.openings.filter(o => o.wallId !== id);
      this.recomputeRooms();
    } else if (type === "door" || type === "window") {
      this.openings = this.openings.filter(o => o.id !== id);
    } else if (type === "object") {
      this.objects = this.objects.filter(o => o.id !== id);
    }
    this.selected = null;
    return true;
  }

  // --- Alles löschen ---------------------------------------------------------

  clear() {
    this._pushHistory();
    this.walls    = [];
    this.openings = [];
    this.objects  = [];
    this.rooms    = [];
    this.selected = null;
  }

  // --- Hilfsmethoden ---------------------------------------------------------

  getWallById(id) {
    return this.walls.find(w => w.id === id) ?? null;
  }

  recomputeRooms() {
    this.rooms = buildOrthogonalRoomsFromWalls(this.walls);
  }

  findWallNear(point, tolerance = 0.3) {
    let best = null;
    for (const wall of this.walls) {
      const result = pointToSegmentDistance(point, wall.start, wall.end);
      const hitTolerance = Math.max(tolerance, wall.thickness / 2 + 0.05);
      if (result.distance <= hitTolerance) {
        if (!best || result.distance < best.distance) {
          best = { wall, distance: result.distance, point: result.point, t: result.t };
        }
      }
    }
    return best;
  }

  findWallByPolygonHit(point) {
    for (let i = this.walls.length - 1; i >= 0; i--) {
      const wall = this.walls[i];
      const poly = wallPolygon(wall.start, wall.end, wall.thickness);
      if (pointInPolygon(point, poly)) return wall;
    }
    return null;
  }

  findObjectAt(point) {
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];
      const left   = obj.x - obj.width / 2;
      const right  = obj.x + obj.width / 2;
      const top    = obj.y - obj.height / 2;
      const bottom = obj.y + obj.height / 2;
      if (point.x >= left && point.x <= right && point.y >= top && point.y <= bottom) {
        return obj;
      }
    }
    return null;
  }

  findOpeningAt(point) {
    for (let i = this.openings.length - 1; i >= 0; i--) {
      const opening = this.openings[i];
      const wall = this.getWallById(opening.wallId);
      if (!wall) continue;
      const wx = wall.end.x - wall.start.x;
      const wy = wall.end.y - wall.start.y;
      const cx = wall.start.x + wx * opening.positionT;
      const cy = wall.start.y + wy * opening.positionT;
      if (Math.hypot(point.x - cx, point.y - cy) < Math.max(0.3, opening.width / 2)) {
        return opening;
      }
    }
    return null;
  }

  // --- Serialisierung --------------------------------------------------------

  toJSON() {
    return JSON.stringify({
      scale:         this.scale,
      gridSize:      this.gridSize,
      snapEnabled:   this.snapEnabled,
      wallThickness: this.wallThickness,
      layers:        this.layers,
      walls:         this.walls,
      openings:      this.openings,
      objects:       this.objects
    }, null, 2);
  }

  loadFromJSON(json) {
    const data = JSON.parse(json);
    this.scale         = data.scale         ?? 80;
    this.gridSize      = data.gridSize      ?? 0.5;
    this.snapEnabled   = data.snapEnabled   ?? true;
    this.wallThickness = data.wallThickness ?? 0.20;
    this.layers        = data.layers        ?? this.layers;
    this.walls         = data.walls         ?? [];
    this.openings      = data.openings      ?? [];
    this.objects       = data.objects       ?? [];
    this.selected      = null;
    this._history      = [];
    this._future       = [];
    this.recomputeRooms();
  }
}
