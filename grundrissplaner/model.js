import {
  buildOrthogonalRoomsFromWalls,
  pointToSegmentDistance,
  wallPolygon,
  pointInPolygon,
  nearlyEqual
} from "./geometry.js";

function uid(prefix = "id") {
  return `${prefix}_${crypto.randomUUID()}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class FloorPlanModel {
  constructor() {
    this.scale = 80;
    this.gridSize = 0.5;
    this.snapEnabled = true;
    this.wallThickness = 0.2;
    this.layers = {
      architecture: true,
      electrical: true,
      sanitary: true,
      heating: true,
      drywall: true,
      dimension: true
    };
    this.floors = [];
    this.currentFloorId = null;
    this.selected = null;
    this.history = [];
    this.future = [];
    this.historyLimit = 100;
    this.createFloor("Etage 1", false);
    this.saveHistory("Initial");
  }

  createEmptyFloor(name) {
    return {
      id: uid("floor"),
      name,
      walls: [],
      openings: [],
      objects: [],
      dimensions: [],
      rooms: []
    };
  }

  createFloor(name = `Etage ${this.floors.length + 1}`, saveHistory = true) {
    if (saveHistory) this.saveHistory("createFloor");
    const floor = this.createEmptyFloor(name);
    this.floors.push(floor);
    this.currentFloorId = floor.id;
    this.selected = null;
    return floor;
  }

  renameCurrentFloor(name) {
    const floor = this.getCurrentFloor();
    if (!floor) return;
    this.saveHistory("renameFloor");
    floor.name = name || floor.name;
  }

  deleteCurrentFloor() {
    if (this.floors.length <= 1) return false;
    this.saveHistory("deleteFloor");
    const index = this.floors.findIndex(f => f.id === this.currentFloorId);
    if (index >= 0) {
      this.floors.splice(index, 1);
      this.currentFloorId = this.floors[Math.max(0, index - 1)].id;
      this.selected = null;
      this.recomputeRooms();
      return true;
    }
    return false;
  }

  setCurrentFloor(id) {
    const floor = this.floors.find(f => f.id === id);
    if (!floor) return false;
    this.currentFloorId = id;
    this.selected = null;
    this.recomputeRooms();
    return true;
  }

  getCurrentFloor() {
    return this.floors.find(f => f.id === this.currentFloorId) || null;
  }

  get walls() {
    return this.getCurrentFloor()?.walls ?? [];
  }

  get openings() {
    return this.getCurrentFloor()?.openings ?? [];
  }

  get objects() {
    return this.getCurrentFloor()?.objects ?? [];
  }

  get dimensions() {
    return this.getCurrentFloor()?.dimensions ?? [];
  }

  get rooms() {
    return this.getCurrentFloor()?.rooms ?? [];
  }

  set rooms(value) {
    const floor = this.getCurrentFloor();
    if (floor) floor.rooms = value;
  }

  getSerializableState() {
    return {
      scale: this.scale,
      gridSize: this.gridSize,
      snapEnabled: this.snapEnabled,
      wallThickness: this.wallThickness,
      layers: deepClone(this.layers),
      floors: deepClone(this.floors),
      currentFloorId: this.currentFloorId
    };
  }

  applyState(state) {
    this.scale = state.scale ?? 80;
    this.gridSize = state.gridSize ?? 0.5;
    this.snapEnabled = state.snapEnabled ?? true;
    this.wallThickness = state.wallThickness ?? 0.2;
    this.layers = deepClone(state.layers ?? this.layers);
    this.floors = deepClone(state.floors ?? []);
    this.currentFloorId = state.currentFloorId ?? this.floors[0]?.id ?? null;
    if (!this.floors.length) {
      const floor = this.createEmptyFloor("Etage 1");
      this.floors = [floor];
      this.currentFloorId = floor.id;
    }
    this.selected = null;
    this.recomputeRooms();
  }

  saveHistory(_label = "") {
    this.history.push(this.getSerializableState());
    if (this.history.length > this.historyLimit) {
      this.history.shift();
    }
    this.future = [];
  }

  undo() {
    if (this.history.length <= 1) return false;
    const current = this.history.pop();
    this.future.push(current);
    const previous = this.history[this.history.length - 1];
    this.applyState(previous);
    return true;
  }

  redo() {
    if (!this.future.length) return false;
    const next = this.future.pop();
    this.history.push(deepClone(next));
    this.applyState(next);
    return true;
  }

  addWall(start, end, thickness = this.wallThickness, layer = "architecture") {
    this.saveHistory("addWall");
    const wall = {
      id: uid("wall"),
      type: "wall",
      layer,
      start: { ...start },
      end: { ...end },
      thickness
    };
    this.walls.push(wall);
    this.recomputeRooms();
    return wall;
  }

  addOpening(kind, wallId, positionT, width, sillHeight = 0, height = 2.1) {
    const wall = this.getWallById(wallId);
    if (!wall) return null;
    this.saveHistory("addOpening");
    const opening = {
      id: uid(kind),
      type: kind,
      layer: "architecture",
      wallId,
      positionT: clamp(positionT, 0.08, 0.92),
      width,
      sillHeight,
      height
    };
    this.openings.push(opening);
    return opening;
  }

  addObject(layer, catalogItem, x, y) {
    this.saveHistory("addObject");
    const object = {
      id: uid(layer),
      type: "object",
      layer,
      catalogId: catalogItem.id,
      name: catalogItem.name,
      symbol: catalogItem.symbol,
      color: catalogItem.color,
      x,
      y,
      width: catalogItem.width,
      height: catalogItem.height,
      rotation: 0
    };
    this.objects.push(object);
    return object;
  }

  addDimension(start, end) {
    this.saveHistory("addDimension");
    const dim = {
      id: uid("dim"),
      type: "dimension",
      layer: "dimension",
      start: { ...start },
      end: { ...end },
      offset: 0.25
    };
    this.dimensions.push(dim);
    return dim;
  }

  getWallById(id) {
    return this.walls.find(w => w.id === id);
  }

  getOpeningById(id) {
    return this.openings.find(o => o.id === id);
  }

  getObjectById(id) {
    return this.objects.find(o => o.id === id);
  }

  getDimensionById(id) {
    return this.dimensions.find(d => d.id === id);
  }

  recomputeRooms() {
    this.rooms = buildOrthogonalRoomsFromWalls(this.walls).map((room, index) => ({
      ...room,
      name: room.name || `Raum ${index + 1}`
    }));
  }

  renameRoom(id, name) {
    const room = this.rooms.find(r => r.id === id);
    if (!room) return;
    this.saveHistory("renameRoom");
    room.name = name || room.name;
  }

  updateWall(id, patch, skipHistory = false) {
    const wall = this.getWallById(id);
    if (!wall) return null;
    if (!skipHistory) this.saveHistory("updateWall");
    if (patch.start) wall.start = { ...wall.start, ...patch.start };
    if (patch.end) wall.end = { ...wall.end, ...patch.end };
    if (patch.thickness != null) wall.thickness = Math.max(0.05, Number(patch.thickness) || wall.thickness);
    if (!nearlyEqual(wall.start.x, wall.end.x) && !nearlyEqual(wall.start.y, wall.end.y)) {
      if (Math.abs(wall.end.x - wall.start.x) >= Math.abs(wall.end.y - wall.start.y)) {
        wall.end.y = wall.start.y;
      } else {
        wall.end.x = wall.start.x;
      }
    }
    this.recomputeRooms();
    return wall;
  }

  updateObject(id, patch, skipHistory = false) {
    const obj = this.getObjectById(id);
    if (!obj) return null;
    if (!skipHistory) this.saveHistory("updateObject");
    if (patch.x != null) obj.x = Number(patch.x);
    if (patch.y != null) obj.y = Number(patch.y);
    if (patch.width != null) obj.width = Math.max(0.05, Number(patch.width));
    if (patch.height != null) obj.height = Math.max(0.05, Number(patch.height));
    if (patch.rotation != null) obj.rotation = Number(patch.rotation);
    if (patch.name != null) obj.name = String(patch.name);
    return obj;
  }

  updateOpening(id, patch, skipHistory = false) {
    const opening = this.getOpeningById(id);
    if (!opening) return null;
    if (!skipHistory) this.saveHistory("updateOpening");
    if (patch.positionT != null) opening.positionT = clamp(Number(patch.positionT), 0.05, 0.95);
    if (patch.width != null) opening.width = Math.max(0.2, Number(patch.width));
    if (patch.height != null) opening.height = Math.max(0.2, Number(patch.height));
    if (patch.sillHeight != null) opening.sillHeight = Math.max(0, Number(patch.sillHeight));
    if (patch.wallId) {
      const wall = this.getWallById(patch.wallId);
      if (wall) opening.wallId = wall.id;
    }
    return opening;
  }

  updateDimension(id, patch, skipHistory = false) {
    const dim = this.getDimensionById(id);
    if (!dim) return null;
    if (!skipHistory) this.saveHistory("updateDimension");
    if (patch.start) dim.start = { ...dim.start, ...patch.start };
    if (patch.end) dim.end = { ...dim.end, ...patch.end };
    if (patch.offset != null) dim.offset = Number(patch.offset);
    return dim;
  }

  duplicateSelected() {
    if (!this.selected) return null;
    this.saveHistory("duplicate");
    if (this.selected.type === "object") {
      const src = this.selected;
      const duplicated = {
        ...deepClone(src),
        id: uid(src.layer),
        x: src.x + 0.5,
        y: src.y + 0.5
      };
      this.objects.push(duplicated);
      this.selected = duplicated;
      return duplicated;
    }
    if (this.selected.type === "wall") {
      const src = this.selected;
      const duplicated = {
        ...deepClone(src),
        id: uid("wall"),
        start: { x: src.start.x + 0.5, y: src.start.y + 0.5 },
        end: { x: src.end.x + 0.5, y: src.end.y + 0.5 }
      };
      this.walls.push(duplicated);
      this.recomputeRooms();
      this.selected = duplicated;
      return duplicated;
    }
    if (this.selected.type === "door" || this.selected.type === "window") {
      const src = this.selected;
      const duplicated = {
        ...deepClone(src),
        id: uid(src.type),
        positionT: clamp(src.positionT + 0.08, 0.05, 0.95)
      };
      this.openings.push(duplicated);
      this.selected = duplicated;
      return duplicated;
    }
    if (this.selected.type === "dimension") {
      const src = this.selected;
      const duplicated = {
        ...deepClone(src),
        id: uid("dim"),
        start: { x: src.start.x + 0.25, y: src.start.y + 0.25 },
        end: { x: src.end.x + 0.25, y: src.end.y + 0.25 }
      };
      this.dimensions.push(duplicated);
      this.selected = duplicated;
      return duplicated;
    }
    return null;
  }

  rotateSelected(deltaRadians = Math.PI / 12) {
    if (!this.selected || this.selected.type !== "object") return false;
    this.saveHistory("rotateSelected");
    this.selected.rotation = Number(this.selected.rotation || 0) + deltaRadians;
    return true;
  }

  deleteSelected() {
    if (!this.selected) return false;
    const selected = this.selected;
    this.saveHistory("deleteSelected");
    if (selected.type === "wall") {
      const removedWallId = selected.id;
      this.walls.splice(this.walls.findIndex(w => w.id === removedWallId), 1);
      const filtered = this.openings.filter(o => o.wallId !== removedWallId);
      this.getCurrentFloor().openings = filtered;
      this.selected = null;
      this.recomputeRooms();
      return true;
    }
    if (selected.type === "object") {
      this.getCurrentFloor().objects = this.objects.filter(o => o.id !== selected.id);
      this.selected = null;
      return true;
    }
    if (selected.type === "door" || selected.type === "window") {
      this.getCurrentFloor().openings = this.openings.filter(o => o.id !== selected.id);
      this.selected = null;
      return true;
    }
    if (selected.type === "dimension") {
      this.getCurrentFloor().dimensions = this.dimensions.filter(d => d.id !== selected.id);
      this.selected = null;
      return true;
    }
    return false;
  }

  findWallNear(point, tolerance = 0.2) {
    let best = null;
    for (const wall of this.walls) {
      const result = pointToSegmentDistance(point, wall.start, wall.end);
      const hitTolerance = Math.max(tolerance, wall.thickness / 2 + 0.05);
      if (result.distance <= hitTolerance) {
        if (!best || result.distance < best.distance) {
          best = {
            wall,
            distance: result.distance,
            point: result.point,
            t: result.t
          };
        }
      }
    }
    return best;
  }

  findWallEndpointAt(point, tolerance = 0.2) {
    for (let i = this.walls.length - 1; i >= 0; i--) {
      const wall = this.walls[i];
      const ds = Math.hypot(point.x - wall.start.x, point.y - wall.start.y);
      if (ds <= tolerance) {
        return { wall, endpoint: "start" };
      }
      const de = Math.hypot(point.x - wall.end.x, point.y - wall.end.y);
      if (de <= tolerance) {
        return { wall, endpoint: "end" };
      }
    }
    return null;
  }

  findWallByPolygonHit(point) {
    for (let i = this.walls.length - 1; i >= 0; i--) {
      const wall = this.walls[i];
      const poly = wallPolygon(wall.start, wall.end, wall.thickness);
      if (pointInPolygon(point, poly)) {
        return wall;
      }
    }
    return null;
  }

  findObjectAt(point) {
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];
      const left = obj.x - obj.width / 2;
      const right = obj.x + obj.width / 2;
      const top = obj.y - obj.height / 2;
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

  findDimensionAt(point, tolerance = 0.2) {
    for (let i = this.dimensions.length - 1; i >= 0; i--) {
      const dim = this.dimensions[i];
      const result = pointToSegmentDistance(point, dim.start, dim.end);
      if (result.distance <= tolerance) return dim;
    }
    return null;
  }

  clear() {
    this.saveHistory("clear");
    const floor = this.getCurrentFloor();
    if (!floor) return;
    floor.walls = [];
    floor.openings = [];
    floor.objects = [];
    floor.dimensions = [];
    floor.rooms = [];
    this.selected = null;
  }

  toJSON() {
    return JSON.stringify(this.getSerializableState(), null, 2);
  }

  loadFromJSON(json) {
    const data = JSON.parse(json);
    this.applyState(data);
    this.history = [this.getSerializableState()];
    this.future = [];
  }
}
