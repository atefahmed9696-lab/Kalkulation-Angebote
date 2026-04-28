import {
  metersToPixels,
  polygonCentroid,
  wallPolygon
} from "./geometry.js";

export class Renderer {
  constructor(canvas, model) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext("2d");
    this.model   = model;
    this.preview = null;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width  = rect.width;
    this.canvas.height = rect.height;
    this.render();
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawGrid();
    this.drawRooms();
    this.drawWalls();
    this.drawOpenings();
    this.drawObjects();
    this.drawPreview();
    this.drawSelection();
  }

  worldToScreen(point) {
    return {
      x: point.x * this.model.scale,
      y: point.y * this.model.scale
    };
  }

  screenToWorld(point) {
    return {
      x: point.x / this.model.scale,
      y: point.y / this.model.scale
    };
  }

  // --- Raster ----------------------------------------------------------------

  drawGrid() {
    const ctx  = this.ctx;
    const step = metersToPixels(this.model.gridSize, this.model.scale);
    ctx.save();
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth   = 1;
    for (let x = 0; x <= this.canvas.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= this.canvas.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.canvas.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- Räume -----------------------------------------------------------------

  drawRooms() {
    const ctx = this.ctx;
    ctx.save();
    for (const room of this.model.rooms) {
      const poly = room.polygon.map(p => this.worldToScreen(p));
      ctx.beginPath();
      poly.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle   = "rgba(59,130,246,0.07)";
      ctx.fill();
      ctx.strokeStyle = "rgba(59,130,246,0.25)";
      ctx.lineWidth   = 1;
      ctx.stroke();

      const center = this.worldToScreen(room.centroid ?? polygonCentroid(room.polygon));
      ctx.fillStyle   = "#1e3a8a";
      ctx.font        = "bold 13px Arial";
      ctx.textAlign   = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${room.area.toFixed(2)} m²`, center.x, center.y);
    }
    ctx.restore();
  }

  // --- Wände -----------------------------------------------------------------

  drawWalls() {
    const ctx = this.ctx;
    ctx.save();
    for (const wall of this.model.walls) {
      if (!this.model.layers[wall.layer]) continue;
      const poly = wallPolygon(wall.start, wall.end, wall.thickness).map(p => this.worldToScreen(p));
      ctx.beginPath();
      poly.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle   = wall.layer === "drywall" ? "#c4b5fd" : "#1f2937";
      ctx.fill();
      ctx.strokeStyle = wall.layer === "drywall" ? "#7c3aed" : "#000";
      ctx.lineWidth   = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- Öffnungen (Türen / Fenster) ------------------------------------------

  drawOpenings() {
    const ctx = this.ctx;
    ctx.save();
    for (const opening of this.model.openings) {
      if (!this.model.layers.architecture) continue;
      const wall = this.model.getWallById(opening.wallId);
      if (!wall) continue;

      const x = wall.start.x + (wall.end.x - wall.start.x) * opening.positionT;
      const y = wall.start.y + (wall.end.y - wall.start.y) * opening.positionT;
      const center  = this.worldToScreen({ x, y });
      const angle   = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);
      const widthPx = metersToPixels(opening.width, this.model.scale);
      const wallPx  = metersToPixels(wall.thickness, this.model.scale);

      ctx.translate(center.x, center.y);
      ctx.rotate(angle);

      // Wandöffnung freistellen
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(-widthPx / 2, -wallPx / 2 - 2, widthPx, wallPx + 4);

      if (opening.type === "door") {
        // Tür: Bogen + Linie
        ctx.strokeStyle = "#16a34a";
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.moveTo(-widthPx / 2, wallPx / 2 + 2);
        ctx.lineTo(widthPx / 2, wallPx / 2 + 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-widthPx / 2, wallPx / 2 + 2, widthPx, -Math.PI / 2, 0);
        ctx.stroke();
      } else if (opening.type === "window") {
        // Fenster: Doppellinie
        ctx.strokeStyle = "#0ea5e9";
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.moveTo(-widthPx / 2, -wallPx / 4);
        ctx.lineTo(widthPx / 2, -wallPx / 4);
        ctx.moveTo(-widthPx / 2, wallPx / 4);
        ctx.lineTo(widthPx / 2, wallPx / 4);
        ctx.stroke();
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.restore();
  }

  // --- Objekte ---------------------------------------------------------------

  drawObjects() {
    const ctx = this.ctx;
    ctx.save();
    for (const obj of this.model.objects) {
      if (!this.model.layers[obj.layer]) continue;
      const center = this.worldToScreen({ x: obj.x, y: obj.y });
      const w = metersToPixels(obj.width,  this.model.scale);
      const h = metersToPixels(obj.height, this.model.scale);

      ctx.translate(center.x, center.y);
      ctx.rotate(obj.rotation);

      ctx.fillStyle   = obj.color;
      ctx.strokeStyle = "#111827";
      ctx.lineWidth   = 1.5;

      switch (obj.symbol) {
        case "socket":
          ctx.beginPath(); ctx.arc(0, 0, w / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          break;
        case "switch":
          ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeRect(-w / 2, -h / 2, w, h);
          break;
        case "lamp":
          ctx.beginPath(); ctx.arc(0, 0, w / 2, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0);
          ctx.moveTo(0, -h / 2); ctx.lineTo(0, h / 2);
          ctx.stroke();
          break;
        case "wc":
          roundRect(ctx, -w / 2, -h / 2, w, h, 10); ctx.fill(); ctx.stroke();
          break;
        case "sink":
          roundRect(ctx, -w / 2, -h / 2, w, h, 8); ctx.stroke();
          ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) / 5, 0, Math.PI * 2); ctx.stroke();
          break;
        case "shower":
          ctx.strokeRect(-w / 2, -h / 2, w, h);
          ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, h / 2); ctx.stroke();
          break;
        case "bathtub":
          roundRect(ctx, -w / 2, -h / 2, w, h, 14); ctx.stroke();
          roundRect(ctx, -w / 2 + 8, -h / 2 + 8, w - 16, h - 24, 10); ctx.stroke();
          break;
        case "radiator":
          ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeRect(-w / 2, -h / 2, w, h);
          for (let rx = -w / 2 + 8; rx < w / 2; rx += 12) {
            ctx.beginPath(); ctx.moveTo(rx, -h / 2); ctx.lineTo(rx, h / 2); ctx.stroke();
          }
          break;
        case "boiler":
          roundRect(ctx, -w / 2, -h / 2, w, h, 6); ctx.fill(); ctx.stroke();
          break;
        default:
          ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeRect(-w / 2, -h / 2, w, h);
      }

      ctx.fillStyle    = "#111827";
      ctx.font         = "11px Arial";
      ctx.textAlign    = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(obj.name, 0, h / 2 + 13);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.restore();
  }

  // --- Vorschau (während Zeichnen) ------------------------------------------

  drawPreview() {
    if (!this.preview) return;
    const ctx = this.ctx;
    ctx.save();

    if (this.preview.type === "wall") {
      const poly = wallPolygon(this.preview.start, this.preview.end, this.preview.thickness)
        .map(p => this.worldToScreen(p));
      ctx.beginPath();
      poly.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle   = "rgba(37,99,235,0.30)";
      ctx.fill();
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      // Längenmaß
      const mid = this.worldToScreen({
        x: (this.preview.start.x + this.preview.end.x) / 2,
        y: (this.preview.start.y + this.preview.end.y) / 2
      });
      const len = Math.hypot(
        this.preview.end.x - this.preview.start.x,
        this.preview.end.y - this.preview.start.y
      );
      ctx.fillStyle    = "#1d4ed8";
      ctx.font         = "bold 12px Arial";
      ctx.textAlign    = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(`${len.toFixed(2)} m`, mid.x, mid.y - 4);
    }

    if (this.preview.type === "object") {
      const c = this.worldToScreen({ x: this.preview.x, y: this.preview.y });
      const w = metersToPixels(this.preview.width,  this.model.scale);
      const h = metersToPixels(this.preview.height, this.model.scale);
      ctx.fillStyle   = "rgba(37,99,235,0.25)";
      ctx.fillRect(c.x - w / 2, c.y - h / 2, w, h);
      ctx.strokeStyle = "#2563eb";
      ctx.strokeRect(c.x - w / 2, c.y - h / 2, w, h);
    }

    if (this.preview.type === "opening") {
      const wall = this.model.getWallById(this.preview.wallId);
      if (wall) {
        const x = wall.start.x + (wall.end.x - wall.start.x) * this.preview.positionT;
        const y = wall.start.y + (wall.end.y - wall.start.y) * this.preview.positionT;
        const center  = this.worldToScreen({ x, y });
        const angle   = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);
        const widthPx = metersToPixels(this.preview.width, this.model.scale);
        const wallPx  = metersToPixels(wall.thickness, this.model.scale);
        ctx.translate(center.x, center.y);
        ctx.rotate(angle);
        ctx.fillStyle   = "rgba(37,99,235,0.18)";
        ctx.fillRect(-widthPx / 2, -wallPx / 2 - 3, widthPx, wallPx + 6);
        ctx.strokeStyle = "#2563eb";
        ctx.strokeRect(-widthPx / 2, -wallPx / 2 - 3, widthPx, wallPx + 6);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    }

    ctx.restore();
  }

  // --- Selektion hervorheben ------------------------------------------------

  drawSelection() {
    const selected = this.model.selected;
    if (!selected) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth   = 2.5;
    ctx.setLineDash([6, 4]);

    if (selected.type === "wall") {
      const poly = wallPolygon(selected.start, selected.end, selected.thickness)
        .map(p => this.worldToScreen(p));
      ctx.beginPath();
      poly.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.stroke();
    } else if (selected.type === "object") {
      const c = this.worldToScreen({ x: selected.x, y: selected.y });
      const w = metersToPixels(selected.width,  this.model.scale);
      const h = metersToPixels(selected.height, this.model.scale);
      ctx.strokeRect(c.x - w / 2, c.y - h / 2, w, h);
    } else if (selected.type === "door" || selected.type === "window") {
      const wall = this.model.getWallById(selected.wallId);
      if (wall) {
        const x = wall.start.x + (wall.end.x - wall.start.x) * selected.positionT;
        const y = wall.start.y + (wall.end.y - wall.start.y) * selected.positionT;
        const c = this.worldToScreen({ x, y });
        ctx.beginPath();
        ctx.arc(c.x, c.y, 14, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}
