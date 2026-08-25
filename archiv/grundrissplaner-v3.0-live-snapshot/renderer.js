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
    this.backgroundImageCache = new Map();
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
    this.drawBackgroundPlan();
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
  drawBackgroundPlan() {
    const plan = this.model.getCurrentFloor()?.backgroundPlan;
    if (!plan?.src) return;
    const image = this.resolveBackgroundImage(plan.src);
    if (!image) return;
    const ctx = this.ctx;
    const widthMeters = Math.max(0.1, Number(plan.widthMeters) || 1);
    const heightMeters = Math.max(0.1, Number(plan.heightMeters) || 1);
    const xMeters = Number(plan.x) || 0;
    const yMeters = Number(plan.y) || 0;
    const opacity = Math.min(1, Math.max(0.1, Number(plan.opacity) || 0.35));
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.drawImage(
      image,
      metersToPixels(xMeters, this.model.scale),
      metersToPixels(yMeters, this.model.scale),
      metersToPixels(widthMeters, this.model.scale),
      metersToPixels(heightMeters, this.model.scale)
    );
    ctx.restore();
  }
  resolveBackgroundImage(src) {
    let image = this.backgroundImageCache.get(src);
    if (!image) {
      image = new Image();
      image.decoding = "async";
      image.src = src;
      image.onload = () => this.render();
      this.backgroundImageCache.set(src, image);
    }
    return image.complete ? image : null;
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
      const center = this.worldToScreen({ x: obj.x, y: obj.y });
      const w = metersToPixels(obj.width, this.model.scale);
      const h = metersToPixels(obj.height, this.model.scale);
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(obj.rotation);
      drawSymbol(ctx, obj.symbol, obj.color, w, h);
      ctx.fillStyle = "#111827";
      ctx.font = `${Math.max(9, 11 / this.zoom)}px Arial`;
      ctx.textAlign = "center";
      ctx.fillText(obj.name, 0, h / 2 + 14 / this.zoom);
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

// ── Hauptzeichenfunktion für alle Symbole ────────────────────────────────────
// ctx is already translated/rotated to center, w/h are pixel sizes.
function drawSymbol(ctx, symbol, color, w, h) {
  ctx.fillStyle = color;
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 1.5;
  const r = Math.min(w, h) / 2;

  switch (symbol) {

    // ── STECKDOSEN ────────────────────────────────────────────────────────────
    case "socket": {
      // Kreis + waagrechter Strich unten-mitte (genormtes Steckdosensymbol)
      ctx.strokeStyle = "#000";
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, r * 0.6); ctx.lineTo(r * 0.5, r * 0.6);
      ctx.stroke();
      // Zwei kurze Kontaktstriche
      ctx.beginPath();
      ctx.moveTo(-r * 0.25, r * 0.25); ctx.lineTo(-r * 0.25, -r * 0.1);
      ctx.moveTo( r * 0.25, r * 0.25); ctx.lineTo( r * 0.25, -r * 0.1);
      ctx.stroke();
      break;
    }
    case "socket-double": {
      ctx.strokeStyle = "#000";
      const ox = w / 4;
      for (const dx of [-ox, ox]) {
        ctx.beginPath(); ctx.arc(dx, 0, r * 0.75, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(dx - r * 0.4, r * 0.45); ctx.lineTo(dx + r * 0.4, r * 0.45); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(dx - r * 0.2, r * 0.2); ctx.lineTo(dx - r * 0.2, -r * 0.1);
        ctx.moveTo(dx + r * 0.2, r * 0.2); ctx.lineTo(dx + r * 0.2, -r * 0.1);
        ctx.stroke();
      }
      break;
    }
    case "socket-outdoor": {
      // Steckdose mit kleinem Dreieck (wasserdicht/außen)
      ctx.strokeStyle = "#000";
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, r * 0.6); ctx.lineTo(r * 0.5, r * 0.6); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.25, r * 0.25); ctx.lineTo(-r * 0.25, -r * 0.1);
      ctx.moveTo( r * 0.25, r * 0.25); ctx.lineTo( r * 0.25, -r * 0.1);
      ctx.stroke();
      // Kleines Dreieck für "außen"
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.moveTo(r * 0.6, -r * 0.8); ctx.lineTo(r, -r * 0.8); ctx.lineTo(r * 0.8, -r * 0.5); ctx.closePath();
      ctx.fill();
      break;
    }
    case "socket-floor": {
      // Bodensteckdose: Kreis + waagrechte Linie durch Mitte
      ctx.strokeStyle = "#000";
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.25, r * 0.25); ctx.lineTo(-r * 0.25, -r * 0.1);
      ctx.moveTo( r * 0.25, r * 0.25); ctx.lineTo( r * 0.25, -r * 0.1);
      ctx.stroke();
      break;
    }

    // ── SCHALTER ──────────────────────────────────────────────────────────────
    case "switch": {
      // Ausschalter: Kreis + diagonale Linie (Schaltarm) oben-rechts
      ctx.strokeStyle = "#000";
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r * 0.5, -r * 0.5); ctx.lineTo(r * 1.2, -r * 1.2); ctx.stroke();
      // kleiner Querstrich am Ende (Schaltarm-Ende)
      ctx.beginPath();
      ctx.moveTo(r * 0.9, -r * 1.4); ctx.lineTo(r * 1.5, -r * 1.0); ctx.stroke();
      break;
    }
    case "switch-2way": {
      // Wechselschalter: wie switch + zweiter Pfeil
      ctx.strokeStyle = "#000";
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r * 0.5, -r * 0.5); ctx.lineTo(r * 1.2, -r * 1.2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r * 0.9, -r * 1.4); ctx.lineTo(r * 1.5, -r * 1.0); ctx.stroke();
      // zweiter Arm
      ctx.beginPath();
      ctx.moveTo(r * 0.5, r * 0.5); ctx.lineTo(r * 1.2, r * 1.2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r * 0.9, r * 1.4); ctx.lineTo(r * 1.5, r * 1.0); ctx.stroke();
      break;
    }
    case "switch-series": {
      // Serienschalter: zwei Ausschalter-Symbole nebeneinander
      ctx.strokeStyle = "#000";
      const sx = w / 4;
      for (const dx of [-sx, sx]) {
        ctx.beginPath(); ctx.arc(dx, 0, r * 0.65, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(dx + r * 0.35, -r * 0.35); ctx.lineTo(dx + r * 0.85, -r * 0.85); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(dx + r * 0.6, -r * 0.95); ctx.lineTo(dx + r * 1.1, -r * 0.6); ctx.stroke();
      }
      break;
    }
    case "switch-dimmer": {
      // Dimmer: Schalterkreis + kleines Dreieck (Keilsymbol)
      ctx.strokeStyle = "#000";
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r * 0.5, -r * 0.5); ctx.lineTo(r * 1.2, -r * 1.2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r * 0.9, -r * 1.4); ctx.lineTo(r * 1.5, -r * 1.0); ctx.stroke();
      // Keil/Pfeil für Dimmer
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, -r * 0.6); ctx.lineTo(-r, -r * 0.2); ctx.lineTo(-r, -r);
      ctx.closePath(); ctx.fill();
      break;
    }
    case "pushbutton": {
      // Taster: Kreis + kurze senkrechte Linie + waagrechter Balken oben
      ctx.strokeStyle = "#000";
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.lineTo(0, -r * 1.6);
      ctx.moveTo(-r * 0.5, -r * 1.6); ctx.lineTo(r * 0.5, -r * 1.6);
      ctx.stroke();
      break;
    }
    case "switch-blind": {
      // Jalousietaster: Taster + Doppelpfeil (hoch/runter)
      ctx.strokeStyle = "#000";
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.lineTo(0, -r * 1.6);
      ctx.moveTo(-r * 0.5, -r * 1.6); ctx.lineTo(r * 0.5, -r * 1.6);
      ctx.stroke();
      // Pfeile hoch/runter
      ctx.beginPath();
      ctx.moveTo(r * 0.8, -r * 0.4); ctx.lineTo(r * 1.4, -r * 0.4);
      ctx.moveTo(r * 1.1, -r * 0.8); ctx.lineTo(r * 0.8, -r * 0.4); ctx.lineTo(r * 1.1, 0);
      ctx.stroke();
      break;
    }

    // ── LEUCHTEN ──────────────────────────────────────────────────────────────
    case "lamp": {
      // Deckenleuchte: Kreis + X (Kreuz)
      ctx.strokeStyle = "#000";
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      const d = r * 0.7;
      ctx.beginPath();
      ctx.moveTo(-d, -d); ctx.lineTo(d, d);
      ctx.moveTo(d, -d); ctx.lineTo(-d, d);
      ctx.stroke();
      break;
    }
    case "lamp-recessed": {
      // Einbauleuchte: gefüllter Kreis + äußerer Ring
      ctx.strokeStyle = "#000";
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      break;
    }
    case "lamp-wall": {
      // Wandleuchte: Halbkreis (oben = Wand)
      ctx.strokeStyle = "#000";
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-r, 0); ctx.arc(0, 0, r, Math.PI, 0); ctx.closePath();
      ctx.fill(); ctx.stroke();
      // Mittellinie
      ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
      break;
    }
    case "lamp-outdoor": {
      // Außenleuchte: Kreis + X + Strahllinien
      ctx.strokeStyle = "#000";
      ctx.beginPath(); ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2); ctx.stroke();
      const d2 = r * 0.45;
      ctx.beginPath();
      ctx.moveTo(-d2, -d2); ctx.lineTo(d2, d2);
      ctx.moveTo(d2, -d2); ctx.lineTo(-d2, d2);
      ctx.stroke();
      // Strahllinien
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * r * 0.7, Math.sin(angle) * r * 0.7);
        ctx.lineTo(Math.cos(angle) * r * 1.1, Math.sin(angle) * r * 1.1);
        ctx.stroke();
      }
      break;
    }
    case "lamp-emergency": {
      // Notleuchte: Rechteck mit Pfeil + "N"
      ctx.fillStyle = color; ctx.strokeStyle = "#000";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = "#000";
      ctx.font = `bold ${h * 0.5}px Arial`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("N", -w * 0.2, 0);
      // Pfeil
      ctx.beginPath();
      ctx.moveTo(w * 0.1, 0); ctx.lineTo(w * 0.45, 0);
      ctx.moveTo(w * 0.3, -h * 0.3); ctx.lineTo(w * 0.45, 0); ctx.lineTo(w * 0.3, h * 0.3);
      ctx.stroke();
      break;
    }
    case "lamp-strip": {
      // Langfeldleuchte: schmales Rechteck mit Mittellinie
      ctx.fillStyle = color; ctx.strokeStyle = "#000";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.stroke();
      break;
    }

    // ── ELEKTROINSTALLATION ───────────────────────────────────────────────────
    case "fan": {
      // Lüfter: Kreis + Flügelblätter
      ctx.strokeStyle = "#000";
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      // 4 Flügelblätter
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(r * 0.2, -r * 0.3, r * 0.6, -r * 0.6, r * 0.6, 0);
        ctx.bezierCurveTo(r * 0.6, r * 0.3, r * 0.2, r * 0.2, 0, 0);
        ctx.fillStyle = color; ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      // Mittelkreis
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      break;
    }
    case "distribution": {
      // Unterverteiler: Rechteck mit UV-Label + Blitz
      ctx.fillStyle = color; ctx.strokeStyle = "#000";
      roundRect(ctx, -w / 2, -h / 2, w, h, 4);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#000";
      ctx.font = `bold ${Math.min(w, h) * 0.4}px Arial`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("UV", 0, 0);
      break;
    }
    case "smoke-detector": {
      // Rauchmelder: Kreis mit "S" + Rauchwellen
      ctx.strokeStyle = "#000";
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#000";
      ctx.font = `bold ${r}px Arial`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("S", 0, 0);
      break;
    }
    case "co-detector": {
      ctx.strokeStyle = "#000";
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#000";
      ctx.font = `bold ${r * 0.7}px Arial`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("CO", 0, 0);
      break;
    }
    case "doorbell": {
      // Klingel: Kreis + kleines Dreieck (Blitz / Klingelsymbol)
      ctx.strokeStyle = "#000";
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, -r * 0.6); ctx.lineTo(r * 0.1, 0); ctx.lineTo(-r * 0.1, 0);
      ctx.lineTo(r * 0.3, r * 0.6);
      ctx.lineTo(-r * 0.1, 0); ctx.lineTo(r * 0.1, 0);
      ctx.lineTo(-r * 0.3, -r * 0.6);
      ctx.fill();
      break;
    }
    case "thermostat": {
      // Thermostat: Kreis + T
      ctx.strokeStyle = "#000";
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#000";
      ctx.font = `bold ${r}px Arial`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("T", 0, 0);
      break;
    }
    case "telephone": {
      // Telefondose: Rechteck + Hörer-Symbol
      ctx.fillStyle = color; ctx.strokeStyle = "#000";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = "#000";
      ctx.font = `${r * 0.9}px Arial`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("☎", 0, 0);
      break;
    }
    case "network": {
      // LAN-Dose: Rechteck + Netz-Symbol
      ctx.fillStyle = color; ctx.strokeStyle = "#000";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
      // Vier Punkte + Stern
      const nr = r * 0.45;
      ctx.beginPath(); ctx.moveTo(0, -nr); ctx.lineTo(0, nr); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-nr, 0); ctx.lineTo(nr, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-nr, -nr); ctx.lineTo(nr, nr); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(nr, -nr); ctx.lineTo(-nr, nr); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, nr * 0.3, 0, Math.PI * 2); ctx.stroke();
      break;
    }
    case "tv": {
      // TV/SAT: Rechteck + Antenne
      ctx.fillStyle = color; ctx.strokeStyle = "#000";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5;
      // Antennenpfeil
      ctx.beginPath();
      ctx.moveTo(0, h * 0.2); ctx.lineTo(0, -h * 0.2);
      ctx.moveTo(-r * 0.5, -h * 0.05); ctx.lineTo(0, -h * 0.2); ctx.lineTo(r * 0.5, -h * 0.05);
      ctx.stroke();
      break;
    }
    case "motion-sensor": {
      // Bewegungsmelder: Kreissektor (Erfassungsbereich)
      ctx.strokeStyle = "#000"; ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, -Math.PI / 3, Math.PI / 3);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      // Radarbögen
      ctx.strokeStyle = "#00000066";
      for (const fr of [0.5, 0.75]) {
        ctx.beginPath();
        ctx.arc(0, 0, r * fr, -Math.PI / 3, Math.PI / 3);
        ctx.stroke();
      }
      break;
    }

    // ── SANITÄR ───────────────────────────────────────────────────────────────
    case "wc": {
      // WC: Rechteck (Spülkasten) + Oval (Becken) + Ovalsitz
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      // Spülkasten
      ctx.fillStyle = color;
      ctx.fillRect(-w / 2, -h / 2, w, h * 0.22);
      ctx.strokeRect(-w / 2, -h / 2, w, h * 0.22);
      // Becken-Oval
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.ellipse(0, h * 0.15, w * 0.42, h * 0.32, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      break;
    }
    case "wc-wall": {
      // Wand-WC: wie WC aber ohne Fuß-Detailbereich
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = color;
      ctx.fillRect(-w / 2, -h / 2, w, h * 0.18);
      ctx.strokeRect(-w / 2, -h / 2, w, h * 0.18);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.ellipse(0, h * 0.12, w * 0.42, h * 0.30, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      // Wandlinie oben
      ctx.lineWidth = 2.5; ctx.strokeStyle = "#555";
      ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.strokeStyle = "#000";
      break;
    }
    case "urinal": {
      // Urinal: Halbkreis/Trapez
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000";
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h / 2);
      ctx.lineTo(w / 2, -h / 2);
      ctx.lineTo(w * 0.4, h / 2);
      ctx.lineTo(-w * 0.4, h / 2);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      // Abfluss
      ctx.beginPath(); ctx.arc(0, h * 0.2, h * 0.1, 0, Math.PI * 2); ctx.stroke();
      // Wandmontage
      ctx.lineWidth = 2.5; ctx.strokeStyle = "#555";
      ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.strokeStyle = "#000";
      break;
    }
    case "bidet": {
      // Bidet: Oval mit Einschnitt vorne
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.38, h * 0.38, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.fillRect(-w * 0.15, h * 0.2, w * 0.3, h * 0.35);
      ctx.beginPath(); ctx.arc(0, h * 0.28, w * 0.12, 0, Math.PI); ctx.stroke();
      break;
    }
    case "sink": {
      // Waschbecken: Rechteck abgerundet + Abfluss-Kreis
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000";
      roundRect(ctx, -w / 2, -h / 2, w, h, Math.min(w, h) * 0.18);
      ctx.fill(); ctx.stroke();
      // Überlauf-Kreis oben
      ctx.beginPath();
      ctx.ellipse(0, -h * 0.28, w * 0.12, h * 0.06, 0, 0, Math.PI * 2); ctx.stroke();
      // Abfluss-Kreis
      ctx.beginPath(); ctx.arc(0, h * 0.1, Math.min(w, h) * 0.12, 0, Math.PI * 2); ctx.stroke();
      break;
    }
    case "sink-double": {
      // Doppelwaschbecken
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000";
      roundRect(ctx, -w / 2, -h / 2, w, h, Math.min(w, h) * 0.12);
      ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -h / 2); ctx.lineTo(0, h / 2); ctx.stroke();
      for (const dx of [-w / 4, w / 4]) {
        ctx.beginPath(); ctx.arc(dx, h * 0.1, Math.min(w, h) * 0.1, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(dx, -h * 0.2, w * 0.08, h * 0.05, 0, 0, Math.PI * 2); ctx.stroke();
      }
      break;
    }
    case "kitchen-sink": {
      // Küchenspüle: flaches Rechteck + Abfluss
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      // Armatur-Kreis
      ctx.beginPath(); ctx.arc(0, -h * 0.22, Math.min(w, h) * 0.08, 0, Math.PI * 2); ctx.stroke();
      // Abfluss
      ctx.beginPath(); ctx.arc(0, h * 0.12, Math.min(w, h) * 0.11, 0, Math.PI * 2); ctx.stroke();
      break;
    }
    case "kitchen-sink-dbl": {
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.beginPath(); ctx.moveTo(0, -h / 2); ctx.lineTo(0, h / 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -h * 0.22, Math.min(w, h) * 0.08, 0, Math.PI * 2); ctx.stroke();
      for (const dx of [-w / 4, w / 4]) {
        ctx.beginPath(); ctx.arc(dx, h * 0.12, Math.min(w, h) * 0.1, 0, Math.PI * 2); ctx.stroke();
      }
      break;
    }
    case "bathtub": {
      // Badewanne: Rechteck + inneres Oval (Wanne)
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      // Wannen-Oval
      ctx.beginPath();
      ctx.ellipse(0, h * 0.08, w * 0.4, h * 0.37, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Armatur-Kreis (kopfende)
      ctx.beginPath(); ctx.arc(0, -h * 0.35, Math.min(w, h) * 0.1, 0, Math.PI * 2); ctx.stroke();
      break;
    }
    case "bathtub-corner": {
      // Eckbadewanne: Viertelkreis im Rechteck
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.beginPath();
      ctx.arc(-w / 2, -h / 2, Math.min(w, h) * 0.85, 0, Math.PI / 2);
      ctx.stroke();
      // Armatur
      ctx.beginPath(); ctx.arc(-w * 0.3, -h * 0.3, Math.min(w, h) * 0.07, 0, Math.PI * 2); ctx.stroke();
      break;
    }
    case "shower": {
      // Duschplatte: Rechteck + diagonale Striche + Ablauf
      ctx.fillStyle = color; ctx.strokeStyle = "#000";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      // Ablauf
      ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) * 0.12, 0, Math.PI * 2); ctx.stroke();
      // Richtungsstriche
      for (let i = 1; i < 4; i++) {
        const t = (i / 4);
        ctx.beginPath();
        ctx.moveTo(-w / 2 + w * t, -h / 2);
        ctx.lineTo(-w / 2, -h / 2 + h * t);
        ctx.stroke();
      }
      break;
    }
    case "shower-corner": {
      // Eckdusche: Viertelkreis
      ctx.fillStyle = color; ctx.strokeStyle = "#000";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.beginPath();
      ctx.arc(-w / 2, -h / 2, Math.min(w, h) * 0.9, 0, Math.PI / 2);
      ctx.strokeStyle = "#000"; ctx.stroke();
      // Ablauf
      ctx.beginPath(); ctx.arc(-w * 0.15, -h * 0.15, Math.min(w, h) * 0.1, 0, Math.PI * 2); ctx.stroke();
      break;
    }
    case "washing-machine": {
      // Waschmaschine: Quadrat + Kreis (Bullaugefenster)
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      // Bullauge
      ctx.beginPath(); ctx.arc(0, h * 0.08, r * 0.6, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, h * 0.08, r * 0.35, 0, Math.PI * 2); ctx.stroke();
      // Bedienleiste oben
      ctx.fillStyle = color;
      ctx.fillRect(-w / 2, -h / 2, w, h * 0.2);
      ctx.strokeRect(-w / 2, -h / 2, w, h * 0.2);
      break;
    }
    case "dryer": {
      // Trockner: wie Waschmaschine + Fön-Symbol
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.beginPath(); ctx.arc(0, h * 0.08, r * 0.6, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, h * 0.08, r * 0.35, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillRect(-w / 2, -h / 2, w, h * 0.2);
      ctx.strokeRect(-w / 2, -h / 2, w, h * 0.2);
      // Kleine Pfeilchen für Luftstrom
      ctx.strokeStyle = "#555"; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(r * 0.7, -h * 0.15); ctx.lineTo(r * 1.2, -h * 0.15);
      ctx.moveTo(r * 1.0, -h * 0.25); ctx.lineTo(r * 1.2, -h * 0.15); ctx.lineTo(r * 1.0, -h * 0.05);
      ctx.stroke();
      ctx.lineWidth = 1.5; ctx.strokeStyle = "#000";
      break;
    }
    case "dishwasher": {
      // Geschirrspüler: Rechteck + stilisiertes Geschirrkorb-Symbol
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = color;
      ctx.fillRect(-w / 2, -h / 2, w, h * 0.18);
      ctx.strokeRect(-w / 2, -h / 2, w, h * 0.18);
      // Wellen für Wasser
      ctx.strokeStyle = "#06b6d4"; ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const y0 = -h * 0.1 + i * h * 0.22;
        ctx.beginPath();
        ctx.moveTo(-w * 0.35, y0);
        ctx.bezierCurveTo(-w * 0.1, y0 - h * 0.08, w * 0.1, y0 + h * 0.08, w * 0.35, y0);
        ctx.stroke();
      }
      ctx.lineWidth = 1.5; ctx.strokeStyle = "#000";
      break;
    }
    case "floor-drain": {
      // Bodenablauf: kleiner Kreis mit X
      ctx.strokeStyle = "#000";
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      const dr = r * 0.65;
      ctx.beginPath();
      ctx.moveTo(-dr, -dr); ctx.lineTo(dr, dr);
      ctx.moveTo(dr, -dr); ctx.lineTo(-dr, dr);
      ctx.stroke();
      break;
    }

    // ── HEIZUNG ───────────────────────────────────────────────────────────────
    case "radiator": {
      // Heizkörper: Rechteck mit horizontalen Lamellen
      ctx.fillStyle = color; ctx.strokeStyle = "#000";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      const segments = Math.max(3, Math.round(w / 12));
      const sw = w / segments;
      for (let i = 1; i < segments; i++) {
        ctx.beginPath();
        ctx.moveTo(-w / 2 + sw * i, -h / 2);
        ctx.lineTo(-w / 2 + sw * i, h / 2);
        ctx.stroke();
      }
      break;
    }
    case "floor-heating": {
      // Fußbodenheizung-Verteiler: Rechteck mit Spirale
      ctx.fillStyle = color; ctx.strokeStyle = "#000";
      roundRect(ctx, -w / 2, -h / 2, w, h, 4);
      ctx.fill(); ctx.stroke();
      // Spirale
      ctx.strokeStyle = "#7f1d1d";
      ctx.beginPath();
      const fhr = r * 0.55;
      for (let a = 0; a <= Math.PI * 4; a += 0.15) {
        const fr = fhr * (1 - a / (Math.PI * 5));
        const px = Math.cos(a) * fr;
        const py = Math.sin(a) * fr;
        if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5;
      break;
    }
    case "chimney": {
      // Schornstein: Quadrat mit X
      ctx.fillStyle = "#9ca3af"; ctx.strokeStyle = "#000";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, h / 2);
      ctx.moveTo(w / 2, -h / 2); ctx.lineTo(-w / 2, h / 2);
      ctx.stroke();
      break;
    }
    case "fireplace": {
      // Kaminofen: Rechteck + U-Form (Feuerstelle) + Flamme
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      // U-Form Feueröffnung
      ctx.fillStyle = "#1c1917";
      ctx.beginPath();
      ctx.moveTo(-w * 0.3, h / 2);
      ctx.lineTo(-w * 0.3, 0);
      ctx.arc(0, 0, w * 0.3, Math.PI, 0);
      ctx.lineTo(w * 0.3, h / 2);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      // Flamme
      ctx.fillStyle = "#f97316";
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.05);
      ctx.bezierCurveTo(-w * 0.12, -h * 0.3, w * 0.18, -h * 0.4, 0, -h * 0.42);
      ctx.bezierCurveTo(-w * 0.1, -h * 0.3, w * 0.08, -h * 0.15, 0, -h * 0.05);
      ctx.fill();
      break;
    }
    case "boiler": {
      // Therme/Boiler: Rechteck abgerundet
      ctx.fillStyle = color; ctx.strokeStyle = "#000";
      roundRect(ctx, -w / 2, -h / 2, w, h, 6);
      ctx.fill(); ctx.stroke();
      // Flammen-Symbol
      ctx.fillStyle = "#f97316";
      ctx.beginPath();
      ctx.moveTo(0, h * 0.1);
      ctx.bezierCurveTo(-w * 0.15, -h * 0.15, w * 0.2, -h * 0.25, 0, -h * 0.3);
      ctx.bezierCurveTo(-w * 0.1, -h * 0.15, w * 0.1, -h * 0.05, 0, h * 0.1);
      ctx.fill();
      break;
    }
    case "heat-pump": {
      // Wärmepumpe: Rechteck + Kreispfeil
      ctx.fillStyle = color; ctx.strokeStyle = "#000";
      roundRect(ctx, -w / 2, -h / 2, w, h, 5);
      ctx.fill(); ctx.stroke();
      // Kreispfeil
      ctx.strokeStyle = "#7f1d1d"; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.5, -Math.PI * 0.8, Math.PI * 0.8);
      ctx.stroke();
      // Pfeilspitze
      const hpAngle = Math.PI * 0.8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(hpAngle) * r * 0.5, Math.sin(hpAngle) * r * 0.5);
      ctx.lineTo(
        Math.cos(hpAngle) * r * 0.5 + Math.cos(hpAngle + Math.PI * 0.4) * r * 0.18,
        Math.sin(hpAngle) * r * 0.5 + Math.sin(hpAngle + Math.PI * 0.4) * r * 0.18
      );
      ctx.stroke();
      ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5;
      break;
    }

    // ── TROCKENBAU ────────────────────────────────────────────────────────────
    case "drywall": {
      ctx.fillStyle = "#c4b5fd"; ctx.strokeStyle = "#7c3aed";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      break;
    }
    case "shaftwall": {
      ctx.fillStyle = "#a78bfa"; ctx.strokeStyle = "#5b21b6";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      // Schraffur
      ctx.lineWidth = 0.8; ctx.strokeStyle = "#5b21b6";
      for (let i = 0; i < 5; i++) {
        const x0 = -w / 2 + (w / 5) * i;
        ctx.beginPath(); ctx.moveTo(x0, -h / 2); ctx.lineTo(x0 + w / 5, h / 2); ctx.stroke();
      }
      break;
    }

    // ── MÖBEL ─────────────────────────────────────────────────────────────────
    case "bed-single": {
      ctx.fillStyle = color; ctx.strokeStyle = "#000";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      // Kopfteil
      ctx.fillStyle = "#86efac";
      ctx.fillRect(-w / 2, -h / 2, w, h * 0.18);
      ctx.strokeRect(-w / 2, -h / 2, w, h * 0.18);
      // Kissen
      ctx.fillStyle = "#fff";
      roundRect(ctx, -w * 0.35, -h * 0.25, w * 0.7, h * 0.2, 4);
      ctx.fill(); ctx.stroke();
      break;
    }
    case "bed-double": {
      ctx.fillStyle = color; ctx.strokeStyle = "#000";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = "#86efac";
      ctx.fillRect(-w / 2, -h / 2, w, h * 0.18);
      ctx.strokeRect(-w / 2, -h / 2, w, h * 0.18);
      // Mittellinie
      ctx.beginPath(); ctx.moveTo(0, -h / 2); ctx.lineTo(0, h / 2); ctx.stroke();
      // Zwei Kissen
      for (const dx of [-w / 4, w / 4]) {
        ctx.fillStyle = "#fff";
        roundRect(ctx, dx - w * 0.2, -h * 0.25, w * 0.38, h * 0.2, 4);
        ctx.fill(); ctx.stroke();
      }
      break;
    }
    case "sofa": {
      ctx.fillStyle = color; ctx.strokeStyle = "#000";
      roundRect(ctx, -w / 2, -h / 2, w, h, 8);
      ctx.fill(); ctx.stroke();
      // Rückenlehne
      ctx.fillStyle = "#84cc16";
      ctx.fillRect(-w / 2, -h / 2, w, h * 0.28);
      ctx.strokeRect(-w / 2, -h / 2, w, h * 0.28);
      // Armlehnen
      ctx.fillStyle = "#84cc16";
      ctx.fillRect(-w / 2, -h / 2, w * 0.12, h);
      ctx.strokeRect(-w / 2, -h / 2, w * 0.12, h);
      ctx.fillRect(w / 2 - w * 0.12, -h / 2, w * 0.12, h);
      ctx.strokeRect(w / 2 - w * 0.12, -h / 2, w * 0.12, h);
      break;
    }
    case "armchair": {
      ctx.fillStyle = color; ctx.strokeStyle = "#000";
      roundRect(ctx, -w / 2, -h / 2, w, h, 8);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#84cc16";
      ctx.fillRect(-w / 2, -h / 2, w, h * 0.28);
      ctx.strokeRect(-w / 2, -h / 2, w, h * 0.28);
      ctx.fillRect(-w / 2, -h / 2, w * 0.15, h);
      ctx.strokeRect(-w / 2, -h / 2, w * 0.15, h);
      ctx.fillRect(w / 2 - w * 0.15, -h / 2, w * 0.15, h);
      ctx.strokeRect(w / 2 - w * 0.15, -h / 2, w * 0.15, h);
      break;
    }
    case "table-round": {
      ctx.fillStyle = color; ctx.strokeStyle = "#000";
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // Stühle (4 kleine Rechtecke um Tisch)
      const sr = r * 1.35;
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        ctx.save();
        ctx.translate(Math.cos(a) * sr, Math.sin(a) * sr);
        ctx.rotate(a);
        ctx.fillStyle = "#f0fdf4"; ctx.strokeStyle = "#000";
        ctx.fillRect(-r * 0.35, -r * 0.2, r * 0.7, r * 0.35);
        ctx.strokeRect(-r * 0.35, -r * 0.2, r * 0.7, r * 0.35);
        ctx.restore();
      }
      break;
    }
    case "wardrobe": {
      ctx.fillStyle = color; ctx.strokeStyle = "#000";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      // Türen
      ctx.beginPath(); ctx.moveTo(0, -h / 2); ctx.lineTo(0, h / 2); ctx.stroke();
      // Türgriffe
      for (const dx of [-w / 8, w / 8]) {
        ctx.beginPath(); ctx.arc(dx, 0, w * 0.04, 0, Math.PI * 2); ctx.stroke();
      }
      break;
    }
    case "stairs-up": {
      // Treppe aufsteigend: Rechteck + Stufen + Pfeil aufwärts
      ctx.fillStyle = "#e5e7eb"; ctx.strokeStyle = "#000";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      const steps = 8;
      const sh = h / steps;
      for (let i = 1; i < steps; i++) {
        ctx.beginPath();
        ctx.moveTo(-w / 2, -h / 2 + sh * i);
        ctx.lineTo(w / 2, -h / 2 + sh * i);
        ctx.stroke();
      }
      // Pfeil nach oben
      ctx.strokeStyle = "#374151"; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.35); ctx.lineTo(0, -h * 0.4);
      ctx.moveTo(-w * 0.2, -h * 0.2); ctx.lineTo(0, -h * 0.4); ctx.lineTo(w * 0.2, -h * 0.2);
      ctx.stroke();
      ctx.lineWidth = 1.5; ctx.strokeStyle = "#000";
      break;
    }
    case "stairs-down": {
      // Treppe absteigend: wie oben aber Pfeil nach unten
      ctx.fillStyle = "#e5e7eb"; ctx.strokeStyle = "#000";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      const steps2 = 8;
      const sh2 = h / steps2;
      for (let i = 1; i < steps2; i++) {
        ctx.beginPath();
        ctx.moveTo(-w / 2, -h / 2 + sh2 * i);
        ctx.lineTo(w / 2, -h / 2 + sh2 * i);
        ctx.stroke();
      }
      ctx.strokeStyle = "#374151"; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.35); ctx.lineTo(0, h * 0.4);
      ctx.moveTo(-w * 0.2, h * 0.2); ctx.lineTo(0, h * 0.4); ctx.lineTo(w * 0.2, h * 0.2);
      ctx.stroke();
      ctx.lineWidth = 1.5; ctx.strokeStyle = "#000";
      break;
    }
    case "column": {
      // Stütze: gefülltes Quadrat (wie DIN)
      ctx.fillStyle = "#374151"; ctx.strokeStyle = "#000";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      break;
    }
    case "column-round": {
      // Rundsäule: gefüllter Kreis
      ctx.fillStyle = "#374151"; ctx.strokeStyle = "#000";
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      break;
    }

    // ── FALLBACK ──────────────────────────────────────────────────────────────
    default: {
      ctx.fillStyle = color;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      break;
    }
  }
}
