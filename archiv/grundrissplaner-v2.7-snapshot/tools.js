import {
  snapPoint,
  projectPointToWall,
  smartOrthoSnap,
  smartSnapPoint
} from "./geometry.js";
import {
  CATALOG
} from "./catalog.js";
export class ToolController {
  constructor(model, renderer, ui) {
    this.model = model;
    this.renderer = renderer;
    this.ui = ui;
    this.currentTool = "select";
    this.currentCatalogItem = null;
    this.dragState = null;
    this.startPoint = null;
  }
  setTool(tool) {
    this.currentTool = tool;
    this.ui.setStatusTool(tool);
    if (["electrical", "sanitary", "heating", "drywall"].includes(tool)) {
      const items = CATALOG[tool];
      this.currentCatalogItem = items[0] ?? null;
      this.ui.populateCatalog(tool, items, this.currentCatalogItem?.id ?? "");
    } else {
      this.currentCatalogItem = null;
      this.ui.populateCatalog(null, [], "");
    }
  }
  setCatalogItemById(layer, id) {
    const item = (CATALOG[layer] || []).find(entry => entry.id === id);
    this.currentCatalogItem = item ?? null;
  }
  normalizePoint(worldPoint, reference = null) {
    if (!this.model.snapEnabled) return worldPoint;
    return smartSnapPoint(worldPoint, this.model.walls, this.model.gridSize, true, reference, this.model.objects);
  }
  onMouseDown(worldPoint) {
    const point = this.normalizePoint(worldPoint);
    if (this.currentTool === "wall" || this.currentTool === "dimension") {
      this.startPoint = point;
      return;
    }
    if (this.currentTool === "door" || this.currentTool === "window") {
      const hit = this.model.findWallNear(point, 0.3);
      if (!hit) return;
      const width = this.currentTool === "door" ? 0.9 : 1.2;
      const opening = this.model.addOpening(this.currentTool, hit.wall.id, hit.t, width);
      this.model.selected = opening;
      this.renderer.render();
      return;
    }
    if (["electrical", "sanitary", "heating", "drywall"].includes(this.currentTool)) {
      if (!this.currentCatalogItem) return;
      const obj = this.model.addObject(this.currentTool, this.currentCatalogItem, point.x, point.y);
      this.model.selected = obj;
      this.renderer.render();
      return;
    }
    if (this.currentTool === "select") {
      const endpointHit = this.model.findWallEndpointAt(point, 0.22);
      if (endpointHit) {
        this.model.selected = endpointHit.wall;
        this.model.saveHistory("dragWallEndpoint");
        this.dragState = {
          type: "wall-endpoint",
          wallId: endpointHit.wall.id,
          endpoint: endpointHit.endpoint
        };
        this.renderer.render();
        return;
      }
      const object = this.model.findObjectAt(point);
      if (object) {
        this.model.selected = object;
        this.model.saveHistory("dragObject");
        this.dragState = {
          type: "object",
          id: object.id,
          offsetX: point.x - object.x,
          offsetY: point.y - object.y
        };
        this.renderer.render();
        return;
      }
      const opening = this.model.findOpeningAt(point);
      if (opening) {
        this.model.selected = opening;
        const wall = this.model.getWallById(opening.wallId);
        if (wall) {
          this.model.saveHistory("dragOpening");
          this.dragState = {
            type: "opening",
            id: opening.id,
            wallId: wall.id
          };
        }
        this.renderer.render();
        return;
      }
      const dim = this.model.findDimensionAt(point, 0.18);
      if (dim) {
        this.model.selected = dim;
        this.model.saveHistory("dragDimension");
        this.dragState = {
          type: "dimension",
          id: dim.id,
          offsetX: point.x - dim.start.x,
          offsetY: point.y - dim.start.y,
          lengthX: dim.end.x - dim.start.x,
          lengthY: dim.end.y - dim.start.y
        };
        this.renderer.render();
        return;
      }
      const wall = this.model.findWallByPolygonHit(point) || this.model.findWallNear(point, 0.22)?.wall;
      if (wall) {
        this.model.selected = wall;
        this.renderer.render();
        return;
      }
      this.model.selected = null;
      this.renderer.render();
    }
  }
  onMouseMove(worldPoint) {
    const point = this.normalizePoint(worldPoint);
    if (this.currentTool === "wall" && this.startPoint) {
      const end = smartOrthoSnap(this.startPoint, worldPoint, this.model.walls, this.model.gridSize, this.model.snapEnabled, this.model.objects);
      this.renderer.preview = {
        type: "wall",
        start: this.startPoint,
        end,
        thickness: this.model.wallThickness
      };
      this.renderer.render();
      return;
    }
    if (this.currentTool === "dimension" && this.startPoint) {
      const end = smartOrthoSnap(this.startPoint, worldPoint, [], this.model.gridSize, this.model.snapEnabled);
      this.renderer.preview = {
        type: "dimension",
        start: this.startPoint,
        end
      };
      this.renderer.render();
      return;
    }
    if (this.currentTool === "door" || this.currentTool === "window") {
      const hit = this.model.findWallNear(point, 0.3);
      if (hit) {
        this.renderer.preview = {
          type: "opening",
          wallId: hit.wall.id,
          positionT: hit.t,
          width: this.currentTool === "door" ? 0.9 : 1.2
        };
      } else {
        this.renderer.preview = null;
      }
      this.renderer.render();
      return;
    }
    if (["electrical", "sanitary", "heating", "drywall"].includes(this.currentTool) && this.currentCatalogItem) {
      this.renderer.preview = {
        type: "object",
        x: point.x,
        y: point.y,
        width: this.currentCatalogItem.width,
        height: this.currentCatalogItem.height
      };
      this.renderer.render();
      return;
    }
    if (this.currentTool === "select" && this.dragState?.type === "object") {
      const obj = this.model.getObjectById(this.dragState.id);
      if (!obj) return;
      const newPoint = this.normalizePoint({
        x: point.x - this.dragState.offsetX,
        y: point.y - this.dragState.offsetY
      }, {
        x: obj.x,
        y: obj.y
      });
      this.model.updateObject(obj.id, {
        x: newPoint.x,
        y: newPoint.y
      }, true);
      this.renderer.render();
      return;
    }
    if (this.currentTool === "select" && this.dragState?.type === "opening") {
      const opening = this.model.getOpeningById(this.dragState.id);
      const wall = this.model.getWallById(this.dragState.wallId);
      if (!opening || !wall) return;
      const result = projectPointToWall(point, wall);
      this.model.updateOpening(opening.id, {
        positionT: Math.max(0.05, Math.min(0.95, result.t)),
        wallId: wall.id
      }, true);
      this.renderer.render();
      return;
    }
    if (this.currentTool === "select" && this.dragState?.type === "wall-endpoint") {
      const wall = this.model.getWallById(this.dragState.wallId);
      if (!wall) return;
      const otherPoint = this.dragState.endpoint === "start" ? wall.end : wall.start;
      const adjusted = smartOrthoSnap(otherPoint, worldPoint, this.model.walls.filter(w => w.id !== wall.id), this.model.gridSize, this.model.snapEnabled, this.model.objects);
      if (this.dragState.endpoint === "start") {
        this.model.updateWall(wall.id, {
          start: adjusted
        }, true);
      } else {
        this.model.updateWall(wall.id, {
          end: adjusted
        }, true);
      }
      this.renderer.render();
      return;
    }
    if (this.currentTool === "select" && this.dragState?.type === "dimension") {
      const dim = this.model.getDimensionById(this.dragState.id);
      if (!dim) return;
      const newStart = {
        x: point.x - this.dragState.offsetX,
        y: point.y - this.dragState.offsetY
      };
      const newEnd = {
        x: newStart.x + this.dragState.lengthX,
        y: newStart.y + this.dragState.lengthY
      };
      this.model.updateDimension(dim.id, {
        start: newStart,
        end: newEnd
      }, true);
      this.renderer.render();
    }
  }
  onMouseUp(worldPoint) {
    if (this.currentTool === "wall" && this.startPoint) {
      const end = smartOrthoSnap(this.startPoint, worldPoint, this.model.walls, this.model.gridSize, this.model.snapEnabled, this.model.objects);
      if (Math.hypot(end.x - this.startPoint.x, end.y - this.startPoint.y) > 0.05) {
        const wall = this.model.addWall(this.startPoint, end, this.model.wallThickness, "architecture");
        this.model.selected = wall;
      }
      this.startPoint = null;
      this.renderer.preview = null;
      this.renderer.render();
    }
    if (this.currentTool === "dimension" && this.startPoint) {
      const end = smartOrthoSnap(this.startPoint, worldPoint, [], this.model.gridSize, this.model.snapEnabled);
      if (Math.hypot(end.x - this.startPoint.x, end.y - this.startPoint.y) > 0.05) {
        const dim = this.model.addDimension(this.startPoint, end);
        this.model.selected = dim;
      }
      this.startPoint = null;
      this.renderer.preview = null;
      this.renderer.render();
    }
    this.dragState = null;
  }
  clearPreview() {
    this.renderer.preview = null;
    this.renderer.render();
  }
}
