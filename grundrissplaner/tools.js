import { snapPoint, orthogonalize, pointToSegmentDistance } from "./geometry.js";
import { CATALOG } from "./catalog.js";

export class ToolController {
  constructor(model, renderer, ui) {
    this.model              = model;
    this.renderer           = renderer;
    this.ui                 = ui;
    this.currentTool        = "select";
    this.currentCatalogItem = null;
    this.dragState          = null;
    this.startPoint         = null;
  }

  setTool(tool) {
    this.currentTool = tool;
    this.ui.setStatusTool(tool);
    const catalogLayers = ["electrical", "sanitary", "heating", "drywall", "furniture"];
    if (catalogLayers.includes(tool)) {
      const items = CATALOG[tool] ?? [];
      this.currentCatalogItem = items[0] ?? null;
      this.ui.populateCatalog(tool, items, this.currentCatalogItem?.id ?? "");
    } else {
      this.currentCatalogItem = null;
      this.ui.populateCatalog(null, [], "");
    }
    this.clearPreview();
  }

  setCatalogItemById(layer, id) {
    const item = (CATALOG[layer] ?? []).find(e => e.id === id);
    this.currentCatalogItem = item ?? null;
  }

  normalizePoint(worldPoint, shiftKey = false) {
    let p = this.model.snapEnabled ? snapPoint(worldPoint, this.model.gridSize) : worldPoint;
    if (shiftKey && this.startPoint) {
      p = orthogonalize(this.startPoint, p);
    }
    return p;
  }

  clearPreview() {
    this.renderer.preview = null;
    this.renderer.render();
  }

  // --- Mausereignisse -------------------------------------------------------

  onMouseDown(worldPoint, shiftKey = false) {
    const point = this.normalizePoint(worldPoint, shiftKey);

    if (this.currentTool === "wall") {
      this.startPoint = point;
      return;
    }

    if (this.currentTool === "door" || this.currentTool === "window") {
      const hit = this.model.findWallNear(point, 0.3);
      if (!hit) return;
      const width   = this.currentTool === "door" ? 0.9 : 1.2;
      const opening = this.model.addOpening(this.currentTool, hit.wall.id, hit.t, width);
      this.model.selected = opening;
      this.renderer.render();
      return;
    }

    const catalogLayers = ["electrical", "sanitary", "heating", "drywall", "furniture"];
    if (catalogLayers.includes(this.currentTool)) {
      if (!this.currentCatalogItem) return;
      const obj = this.model.addObject(this.currentCatalogItem, point.x, point.y);
      this.model.selected = obj;
      this.renderer.render();
      return;
    }

    if (this.currentTool === "select") {
      // Öffnung treffen?
      const opening = this.model.findOpeningAt(point);
      if (opening) {
        this.model.selected = opening;
        this.dragState = { type: "opening", opening, startPoint: point };
        this.renderer.render();
        return;
      }
      // Wand (Polygon) treffen?
      const wall = this.model.findWallByPolygonHit(point);
      if (wall) {
        this.model.selected = wall;
        this.dragState = {
          type:       "wall",
          wall,
          startPoint: point,
          origStart:  { ...wall.start },
          origEnd:    { ...wall.end }
        };
        this.renderer.render();
        return;
      }
      // Objekt treffen?
      const obj = this.model.findObjectAt(point);
      if (obj) {
        this.model.selected = obj;
        this.dragState = {
          type:      "object",
          obj,
          startPoint: point,
          origX:      obj.x,
          origY:      obj.y
        };
        this.renderer.render();
        return;
      }
      // Nichts getroffen → Auswahl aufheben
      this.model.selected = null;
      this.renderer.render();
    }
  }

  onMouseMove(worldPoint, shiftKey = false) {
    const point = this.normalizePoint(worldPoint, shiftKey);

    // Wand-Vorschau
    if (this.currentTool === "wall" && this.startPoint) {
      this.renderer.preview = {
        type:      "wall",
        start:     this.startPoint,
        end:       point,
        thickness: this.model.wallThickness
      };
      this.renderer.render();
      return;
    }

    // Objekt-Vorschau
    const catalogLayers = ["electrical", "sanitary", "heating", "drywall", "furniture"];
    if (catalogLayers.includes(this.currentTool) && this.currentCatalogItem) {
      this.renderer.preview = {
        type:   "object",
        x:      point.x,
        y:      point.y,
        width:  this.currentCatalogItem.width,
        height: this.currentCatalogItem.height
      };
      this.renderer.render();
      return;
    }

    // Tür/Fenster-Vorschau
    if (this.currentTool === "door" || this.currentTool === "window") {
      const hit = this.model.findWallNear(point, 0.4);
      if (hit) {
        this.renderer.preview = {
          type:      "opening",
          wallId:    hit.wall.id,
          positionT: hit.t,
          width:     this.currentTool === "door" ? 0.9 : 1.2
        };
      } else {
        this.renderer.preview = null;
      }
      this.renderer.render();
      return;
    }

    // Drag-Operationen
    if (this.currentTool === "select" && this.dragState) {
      const dx = point.x - this.dragState.startPoint.x;
      const dy = point.y - this.dragState.startPoint.y;

      if (this.dragState.type === "wall") {
        const w = this.dragState.wall;
        w.start = {
          x: this.dragState.origStart.x + dx,
          y: this.dragState.origStart.y + dy
        };
        w.end = {
          x: this.dragState.origEnd.x + dx,
          y: this.dragState.origEnd.y + dy
        };
        this.model.recomputeRooms();
        this.renderer.render();
      } else if (this.dragState.type === "object") {
        this.dragState.obj.x = this.dragState.origX + dx;
        this.dragState.obj.y = this.dragState.origY + dy;
        this.renderer.render();
      } else if (this.dragState.type === "opening") {
        const wall = this.model.getWallById(this.dragState.opening.wallId);
        if (wall) {
          const hit = pointToSegmentDistance(point, wall.start, wall.end);
          this.dragState.opening.positionT = Math.max(0.05, Math.min(0.95, hit.t));
          this.renderer.render();
        }
      }
    }
  }

  onMouseUp(worldPoint, shiftKey = false) {
    if (this.currentTool === "wall" && this.startPoint) {
      const point = this.normalizePoint(worldPoint, shiftKey);
      const len   = Math.hypot(point.x - this.startPoint.x, point.y - this.startPoint.y);
      if (len > 0.1) {
        const wall = this.model.addWall(this.startPoint, point);
        this.model.selected = wall;
      }
      this.startPoint = null;
      this.renderer.preview = null;
      this.renderer.render();
      return;
    }

    // Drag beenden – Undo-Snapshot nachholen (Drag ändert ohne pushHistory)
    if (this.dragState) {
      // Wir haben während des Drags direkt am Objekt geändert ohne Snapshot.
      // Snapshot hier für das Ergebnis pushen (revert-fähig).
      // Tipp: Wir tun dies, indem wir manuell einen früheren Snapshot simulieren.
      // Einfachste Lösung: push NACH dem drag (next undo wird Zustand VOR drag heilen).
      // Dafür: snapshot bereits vor dem drag gepusht (onMouseDown löst _pushHistory nicht aus).
      // → Korrekte Lösung: Wir pushen am Ende des Drags einen Snapshot der alten Werte.
      // Da wir origStart/origEnd/origX/origY haben, rekonstruieren wir die Vor-Drag-Daten.
      if (this.dragState.type === "wall") {
        const wall    = this.dragState.wall;
        const curr    = this.model._snapshot();
        // alten Zustand rekonstruieren
        const oldStart = this.dragState.origStart;
        const oldEnd   = this.dragState.origEnd;
        const oldWall  = { ...wall, start: oldStart, end: oldEnd };
        const tempWalls = this.model.walls.map(w => w.id === wall.id ? oldWall : w);
        const oldSnap   = JSON.stringify({ walls: tempWalls, openings: this.model.openings, objects: this.model.objects });
        this.model._history.push(oldSnap);
        this.model._future  = [];
        this.model.recomputeRooms();
      } else if (this.dragState.type === "object") {
        const obj  = this.dragState.obj;
        const origObj = { ...obj, x: this.dragState.origX, y: this.dragState.origY };
        const tempObjs = this.model.objects.map(o => o.id === obj.id ? origObj : o);
        const oldSnap = JSON.stringify({ walls: this.model.walls, openings: this.model.openings, objects: tempObjs });
        this.model._history.push(oldSnap);
        this.model._future  = [];
      } else if (this.dragState.type === "opening") {
        this.model._history.push(this.model._snapshot());
        this.model._future  = [];
      }
      this.dragState = null;
      this.renderer.render();
    }
  }
}
