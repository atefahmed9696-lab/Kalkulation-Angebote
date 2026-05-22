import {
  metersToPixels,
  polygonCentroid,
  wallPolygon,
  wallOutlineWithJoins,
  distance,
  buildRenderableWalls
} from "./geometry.js";
import {
  drawPlanFrame,
  drawPaperShadow,
  fillTitleBlock,
  computePaperRect
} from "./layout.js";
export class Renderer {
  constructor(canvas, model) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.model = model;
    this.preview = null;
    this.showFrame = true;
    // V3.0: Pan & Zoom
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1.0;
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.render();
  }
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.showFrame) {
      drawPaperShadow(ctx, computePaperRect(this.canvas.width, this.canvas.height, this.model.projectMeta.paperFormat));
    } else {
      this.drawPaperBackground();
    }
    // V3.0: Apply pan/zoom transform for content
    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);
    this.drawGrid();
    this.drawRooms();
    this.drawWalls();
    this.drawObjects();
    this.drawOpenings();
    this.drawDimensions();
    this.drawWallNodes();
    this.drawPreview();
    this.drawSelection();
    ctx.restore();
    // Frame is always in screen-space, not affected by pan/zoom
    this.drawFrame();
  }
  worldToScreen(point) {
    return {
      x: point.x * this.model.scale,
      y: point.y * this.model.scale
    };
  }
  screenToWorld(point) {
    // V3.0: account for pan and zoom
    return {
      x: (point.x - this.panX) / (this.model.scale * this.zoom),
      y: (point.y - this.panY) / (this.model.scale * this.zoom)
    };
  }
  drawPaperBackground() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }
  drawGrid() {
    const ctx = this.ctx;
    const scale = this.model.scale;
    const step = metersToPixels(this.model.gridSize, scale);
    // Compute visible range in model-screen coordinates (pre-zoom/pan space)
    const visLeft   = -this.panX / this.zoom;
    const visTop    = -this.panY / this.zoom;
    const visRight  = (this.canvas.width  - this.panX) / this.zoom;
    const visBottom = (this.canvas.height - this.panY) / this.zoom;
    const startX = Math.floor(visLeft  / step) * step;
    const startY = Math.floor(visTop   / step) * step;
    ctx.save();
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1 / this.zoom; // constant visual line width
    for (let x = startX; x <= visRight; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, visTop);
      ctx.lineTo(x, visBottom);
      ctx.stroke();
    }
    for (let y = startY; y <= visBottom; y += step) {
      ctx.beginPath();
      ctx.moveTo(visLeft, y);
      ctx.lineTo(visRight, y);
      ctx.stroke();
    }
    ctx.restore();
  }
  drawRooms() {
    const ctx = this.ctx;
    ctx.save();
    for (const room of this.model.rooms) {
      const poly = room.polygon.map(p => this.worldToScreen(p));
      ctx.beginPath();
      poly.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.fillStyle = ROOM_TYPE_COLORS[room.roomType] || ROOM_TYPE_COLORS.default;
      ctx.fill();
      ctx.strokeStyle = "rgba(59,130,246,0.28)";
      ctx.lineWidth = 1 / this.zoom;
      ctx.stroke();
      const center = this.worldToScreen(room.centroid ?? polygonCentroid(room.polygon));
      ctx.fillStyle = "#1e3a8a";
      ctx.font = `bold ${14 / this.zoom}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(room.name || "Raum", center.x, center.y - 10 / this.zoom);
      ctx.fillStyle = "#374151";
      ctx.font = `${12 / this.zoom}px Arial`;
      ctx.fillText(`${room.area.toFixed(2)} m²`, center.x, center.y + 10 / this.zoom);
    }
    ctx.restore();
  }
  drawWalls() {
    const ctx = this.ctx;
    const renderWalls = buildRenderableWalls(this.model.walls);
    ctx.save();
    for (const wall of renderWalls) {
      if (!this.model.layers[wall.layer]) continue;
      const poly = wallOutlineWithJoins(wall, renderWalls).map(p => this.worldToScreen(p));
      ctx.beginPath();
      poly.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.fillStyle = wall.layer === "drywall" ? "#c4b5fd" : "#111827";
      ctx.fill();
      ctx.strokeStyle = wall.layer === "drywall" ? "#7c3aed" : "#000000";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    for (const wall of this.model.walls) {
      if (!this.model.layers[wall.layer]) continue;
      const a = this.worldToScreen(wall.start);
      const b = this.worldToScreen(wall.end);
      const m = this.worldToScreen({
        x: (wall.start.x + wall.end.x) / 2,
        y: (wall.start.y + wall.end.y) / 2
      });
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(a.x, a.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#94a3b8";
      ctx.beginPath();
      ctx.arc(m.x, m.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  drawWallNodes() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "#ef4444";
    for (const node of this.model.wallNodes || []) {
      const p = this.worldToScreen(node);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  drawOpenings() {
    const ctx = this.ctx;
    ctx.save();
    for (const opening of this.model.openings) {
      if (!this.model.layers.architecture) continue;
      const wall = this.model.getWallById(opening.wallId);
      if (!wall) continue;
      const x = wall.start.x + (wall.end.x - wall.start.x) * opening.positionT;
      const y = wall.start.y + (wall.end.y - wall.start.y) * opening.positionT;
      const center = this.worldToScreen({
        x,
        y
      });
      const angle = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);
      const widthPx = metersToPixels(opening.width, this.model.scale);
      const wallPx = metersToPixels(wall.thickness, this.model.scale);
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(angle);
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(-widthPx / 2, -wallPx / 2 - 3, widthPx, wallPx + 6);
      if (opening.type === "door") {
        ctx.strokeStyle = "#16a34a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-widthPx / 2, wallPx / 2);
        ctx.lineTo(widthPx / 2, wallPx / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-widthPx / 2, wallPx / 2, widthPx, -Math.PI / 2, 0);
        ctx.stroke();
      } else if (opening.type === "window") {
        ctx.strokeStyle = "#0ea5e9";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-widthPx / 2, 0);
        ctx.lineTo(widthPx / 2, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-widthPx / 4, -wallPx / 3);
        ctx.lineTo(-widthPx / 4, wallPx / 3);
        ctx.moveTo(widthPx / 4, -wallPx / 3);
        ctx.lineTo(widthPx / 4, wallPx / 3);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }
  drawObjects() {
    const ctx = this.ctx;
    ctx.save();
    for (const obj of this.model.objects) {
      if (!this.model.layers[obj.layer]) continue;
      const center = this.worldToScreen({
        x: obj.x,
        y: obj.y
      });
      const w = metersToPixels(obj.width, this.model.scale);
      const h = metersToPixels(obj.height, this.model.scale);
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(obj.rotation);
      ctx.fillStyle = obj.color;
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 1.5;
      if (obj.symbol === "socket") {
        ctx.beginPath();
        ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (obj.symbol === "switch") {
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeRect(-w / 2, -h / 2, w, h);
      } else if (obj.symbol === "lamp") {
        ctx.beginPath();
        ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-w / 2, 0);
        ctx.lineTo(w / 2, 0);
        ctx.moveTo(0, -h / 2);
        ctx.lineTo(0, h / 2);
        ctx.stroke();
      } else if (obj.symbol === "wc") {
        roundRect(ctx, -w / 2, -h / 2, w, h, 10);
        ctx.fill();
        ctx.stroke();
      } else if (obj.symbol === "sink") {
        roundRect(ctx, -w / 2, -h / 2, w, h, 8);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, Math.min(w, h) / 5, 0, Math.PI * 2);
        ctx.stroke();
      } else if (obj.symbol === "shower") {
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        ctx.beginPath();
        ctx.moveTo(-w / 2, -h / 2);
        ctx.lineTo(w / 2, h / 2);
        ctx.stroke();
      } else if (obj.symbol === "radiator") {
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeRect(-w / 2, -h / 2, w, h);
      } else if (obj.symbol === "boiler") {
        roundRect(ctx, -w / 2, -h / 2, w, h, 6);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeRect(-w / 2, -h / 2, w, h);
      }
      ctx.fillStyle = "#111827";
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      ctx.fillText(obj.name, 0, h / 2 + 14);
      ctx.restore();
    }
    ctx.restore();
  }
  drawDimensions() {
    if (!this.model.layers.dimension) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = "#dc2626";
    ctx.fillStyle = "#dc2626";
    ctx.lineWidth = 1.5;
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const dim of this.model.dimensions) {
      const a = this.worldToScreen(dim.start);
      const b = this.worldToScreen(dim.end);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const offsetPx = metersToPixels(dim.offset ?? 0.25, this.model.scale);
      const a2 = {
        x: a.x + nx * offsetPx,
        y: a.y + ny * offsetPx
      };
      const b2 = {
        x: b.x + nx * offsetPx,
        y: b.y + ny * offsetPx
      };
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a2.x, a2.y);
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b2.x, b2.y);
      ctx.moveTo(a2.x, a2.y);
      ctx.lineTo(b2.x, b2.y);
      ctx.stroke();
      this.drawArrow(ctx, a2, b2);
      this.drawArrow(ctx, b2, a2);
      const mx = (a2.x + b2.x) / 2;
      const my = (a2.y + b2.y) / 2;
      const distMeters = distance(dim.start, dim.end).toFixed(2);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(mx - 26, my - 10, 52, 20);
      ctx.strokeStyle = "#dc2626";
      ctx.strokeRect(mx - 26, my - 10, 52, 20);
      ctx.fillStyle = "#dc2626";
      ctx.fillText(`${distMeters} m`, mx, my);
    }
    ctx.restore();
  }
  drawArrow(ctx, from, to) {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const size = 8;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(from.x + Math.cos(angle + Math.PI / 6) * size, from.y + Math.sin(angle + Math.PI / 6) * size);
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(from.x + Math.cos(angle - Math.PI / 6) * size, from.y + Math.sin(angle - Math.PI / 6) * size);
    ctx.stroke();
  }
  drawPreview() {
    if (!this.preview) return;
    const ctx = this.ctx;
    ctx.save();
    if (this.preview.type === "wall") {
      const pseudoWall = {
        id: "__preview__",
        start: this.preview.start,
        end: this.preview.end,
        thickness: this.preview.thickness
      };
      const poly = wallOutlineWithJoins(pseudoWall, [pseudoWall, ...this.model.walls]).map(p => this.worldToScreen(p));
      ctx.beginPath();
      poly.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.fillStyle = "rgba(37,99,235,0.35)";
      ctx.fill();
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (this.preview.type === "object") {
      const c = this.worldToScreen({
        x: this.preview.x,
        y: this.preview.y
      });
      const w = metersToPixels(this.preview.width, this.model.scale);
      const h = metersToPixels(this.preview.height, this.model.scale);
      ctx.fillStyle = "rgba(37,99,235,0.35)";
      ctx.fillRect(c.x - w / 2, c.y - h / 2, w, h);
      ctx.strokeStyle = "#2563eb";
      ctx.strokeRect(c.x - w / 2, c.y - h / 2, w, h);
    }
    if (this.preview.type === "opening") {
      const wall = this.model.getWallById(this.preview.wallId);
      if (wall) {
        const x = wall.start.x + (wall.end.x - wall.start.x) * this.preview.positionT;
        const y = wall.start.y + (wall.end.y - wall.start.y) * this.preview.positionT;
        const center = this.worldToScreen({
          x,
          y
        });
        const angle = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);
        const widthPx = metersToPixels(this.preview.width, this.model.scale);
        const wallPx = metersToPixels(wall.thickness, this.model.scale);
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate(angle);
        ctx.fillStyle = "rgba(37,99,235,0.20)";
        ctx.fillRect(-widthPx / 2, -wallPx / 2 - 3, widthPx, wallPx + 6);
        ctx.strokeStyle = "#2563eb";
        ctx.strokeRect(-widthPx / 2, -wallPx / 2 - 3, widthPx, wallPx + 6);
        ctx.restore();
      }
    }
    if (this.preview.type === "dimension") {
      const a = this.worldToScreen(this.preview.start);
      const b = this.worldToScreen(this.preview.end);
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }
  drawSelection() {
    const selected = this.model.selected;
    if (!selected) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    if (selected.type === "wall") {
      const poly = wallOutlineWithJoins(selected, this.model.walls).map(p => this.worldToScreen(p));
      ctx.beginPath();
      poly.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.stroke();
    } else if (selected.type === "object") {
      const c = this.worldToScreen({
        x: selected.x,
        y: selected.y
      });
      const w = metersToPixels(selected.width, this.model.scale);
      const h = metersToPixels(selected.height, this.model.scale);
      ctx.strokeRect(c.x - w / 2, c.y - h / 2, w, h);
    } else if (selected.type === "door" || selected.type === "window") {
      const wall = this.model.getWallById(selected.wallId);
      if (wall) {
        const x = wall.start.x + (wall.end.x - wall.start.x) * selected.positionT;
        const y = wall.start.y + (wall.end.y - wall.start.y) * selected.positionT;
        const c = this.worldToScreen({
          x,
          y
        });
        ctx.beginPath();
        ctx.arc(c.x, c.y, 14, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (selected.type === "dimension") {
      const a = this.worldToScreen(selected.start);
      const b = this.worldToScreen(selected.end);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }
  drawFrame() {
    if (!this.showFrame) return;
    const floor = this.model.getCurrentFloor();
    drawPlanFrame(this.ctx, this.canvas.width, this.canvas.height, {
      paperFormat: this.model.projectMeta.paperFormat
    });
    fillTitleBlock(this.ctx, this.canvas.width, this.canvas.height, {
      projectName: this.model.projectMeta.projectName,
      scaleLabel:  this.model.projectMeta.scaleLabel,
      drawingTitle: this.model.projectMeta.drawingTitle,
      paperFormat: this.model.projectMeta.paperFormat,
      versionLabel: this.model.projectMeta.versionLabel,
      floorName:   floor?.name || "-",
      dateLabel:   new Date().toLocaleDateString("de-DE")
    });
  }

  getPaperRect() {
    return computePaperRect(this.canvas.width, this.canvas.height, this.model.projectMeta.paperFormat);
  }

  // V3.0: Zoom helpers
  resetView() {
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1.0;
    this.render();
  }

  zoomAt(screenX, screenY, factor) {
    // Zoom centered on cursor position
    const newZoom = Math.min(8, Math.max(0.1, this.zoom * factor));
    this.panX = screenX - (screenX - this.panX) * (newZoom / this.zoom);
    this.panY = screenY - (screenY - this.panY) * (newZoom / this.zoom);
    this.zoom = newZoom;
    this.render();
  }
}

// V3.0: Room type colors (React-Planner inspired)
const ROOM_TYPE_COLORS = {
  wohnzimmer:   "rgba(253,224,71,0.14)",
  schlafzimmer: "rgba(167,243,208,0.18)",
  kinderzimmer: "rgba(196,181,253,0.18)",
  kueche:       "rgba(252,165,165,0.18)",
  bad:          "rgba(147,197,253,0.25)",
  wc:           "rgba(125,211,252,0.22)",
  flur:         "rgba(209,213,219,0.18)",
  buero:        "rgba(167,243,208,0.15)",
  keller:       "rgba(156,163,175,0.20)",
  garage:       "rgba(203,213,225,0.20)",
  default:      "rgba(59,130,246,0.08)"
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
