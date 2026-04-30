import {
  FloorPlanModel
} from "./model.js";
import {
  Renderer
} from "./renderer.js";
import {
  ToolController
} from "./tools.js";
import {
  exportCanvasToPDF
} from "./pdf-export.js";
const canvas = document.getElementById("canvas");
const model = new FloorPlanModel();
const renderer = new Renderer(canvas, model);
const ui = {
  toolButtons: [...document.querySelectorAll(".tool-btn")],
  layerCheckboxes: [...document.querySelectorAll("[data-layer]")],
  snapToggle: document.getElementById("snap-toggle"),
  gridSizeInput: document.getElementById("grid-size"),
  wallThicknessInput: document.getElementById("wall-thickness"),
  catalogSelect: document.getElementById("catalog-select"),
  propertiesPanel: document.getElementById("properties-panel"),
  statusLeft: document.getElementById("status-left"),
  statusCenter: document.getElementById("status-center"),
  statusRight: document.getElementById("status-right"),
  floorSelect: document.getElementById("floor-select"),
  setStatusTool(tool) {
    const names = {
      select: "Auswahl",
      wall: "Wand",
      door: "Tür",
      window: "Fenster",
      dimension: "Bemaßung",
      electrical: "Elektro",
      sanitary: "Sanitär",
      heating: "Heizung",
      drywall: "Trockenbau"
    };
    this.statusLeft.textContent = `Werkzeug: ${names[tool] ?? tool}`;
  },
  populateCatalog(layer, items, selectedId) {
    this.catalogSelect.innerHTML = "";
    if (!layer || !items.length) {
      const opt = document.createElement("option");
      opt.textContent = "Kein Katalog aktiv";
      opt.value = "";
      this.catalogSelect.appendChild(opt);
      return;
    }
    for (const item of items) {
      const opt = document.createElement("option");
      opt.value = item.id;
      opt.textContent = item.name;
      if (item.id === selectedId) opt.selected = true;
      this.catalogSelect.appendChild(opt);
    }
  },
  refreshFloorList() {
    this.floorSelect.innerHTML = "";
    for (const floor of model.floors) {
      const opt = document.createElement("option");
      opt.value = floor.id;
      opt.textContent = floor.name;
      if (floor.id === model.currentFloorId) opt.selected = true;
      this.floorSelect.appendChild(opt);
    }
  },
  updateProperties(selected) {
    if (!selected) {
      this.propertiesPanel.innerHTML = `        <div class="prop-row"><span class="prop-label">Projekt</span></div>        <div class="prop-row">Projektname <input id="meta-project-name" type="text" value="${model.projectMeta.projectName}"></div>        <div class="prop-row">Zeichnung <input id="meta-drawing-title" type="text" value="${model.projectMeta.drawingTitle}"></div>        <div class="prop-row">Maßstab <input id="meta-scale-label" type="text" value="${model.projectMeta.scaleLabel}"></div>        <div class="prop-row">Format <input id="meta-paper-format" type="text" value="${model.projectMeta.paperFormat}"></div>        <button id="apply-meta">Projekt übernehmen</button>      `;
      document.getElementById("apply-meta").onclick = () => {
        model.saveHistory("updateProjectMeta");
        model.projectMeta.projectName = document.getElementById("meta-project-name").value;
        model.projectMeta.drawingTitle = document.getElementById("meta-drawing-title").value;
        model.projectMeta.scaleLabel = document.getElementById("meta-scale-label").value;
        model.projectMeta.paperFormat = document.getElementById("meta-paper-format").value;
        refreshAll();
      };
      return;
    }
    if (selected.type === "wall") {
      this.propertiesPanel.innerHTML = `        <div class="prop-row"><span class="prop-label">Typ</span>: Wand</div>        <div class="prop-row">Start X <input id="prop-start-x" type="number" step="0.1" value="${selected.start.x}"></div>        <div class="prop-row">Start Y <input id="prop-start-y" type="number" step="0.1" value="${selected.start.y}"></div>        <div class="prop-row">Ende X <input id="prop-end-x" type="number" step="0.1" value="${selected.end.x}"></div>        <div class="prop-row">Ende Y <input id="prop-end-y" type="number" step="0.1" value="${selected.end.y}"></div>        <div class="prop-row">Stärke <input id="prop-thickness" type="number" min="0.05" step="0.01" value="${selected.thickness}"></div>        <button id="apply-props">Übernehmen</button>      `;
      document.getElementById("apply-props").onclick = () => {
        model.updateWall(selected.id, {
          start: {
            x: Number(document.getElementById("prop-start-x").value),
            y: Number(document.getElementById("prop-start-y").value)
          },
          end: {
            x: Number(document.getElementById("prop-end-x").value),
            y: Number(document.getElementById("prop-end-y").value)
          },
          thickness: Number(document.getElementById("prop-thickness").value)
        });
        refreshAll();
      };
      return;
    }
    if (selected.type === "object") {
      this.propertiesPanel.innerHTML = `        <div class="prop-row"><span class="prop-label">Typ</span>: ${selected.name}</div>        <div class="prop-row">Name <input id="prop-name" type="text" value="${selected.name}"></div>        <div class="prop-row">X <input id="prop-x" type="number" step="0.1" value="${selected.x}"></div>        <div class="prop-row">Y <input id="prop-y" type="number" step="0.1" value="${selected.y}"></div>        <div class="prop-row">Breite <input id="prop-width" type="number" min="0.05" step="0.05" value="${selected.width}"></div>        <div class="prop-row">Höhe <input id="prop-height" type="number" min="0.05" step="0.05" value="${selected.height}"></div>        <div class="prop-row">Rotation <input id="prop-rotation" type="number" step="0.1" value="${selected.rotation}"></div>        <button id="apply-props">Übernehmen</button>      `;
      document.getElementById("apply-props").onclick = () => {
        model.updateObject(selected.id, {
          name: document.getElementById("prop-name").value,
          x: Number(document.getElementById("prop-x").value),
          y: Number(document.getElementById("prop-y").value),
          width: Number(document.getElementById("prop-width").value),
          height: Number(document.getElementById("prop-height").value),
          rotation: Number(document.getElementById("prop-rotation").value)
        });
        refreshAll();
      };
      return;
    }
    if (selected.type === "door" || selected.type === "window") {
      this.propertiesPanel.innerHTML = `        <div class="prop-row"><span class="prop-label">Typ</span>: ${selected.type}</div>        <div class="prop-row">Position t <input id="prop-t" type="number" min="0.05" max="0.95" step="0.01" value="${selected.positionT}"></div>        <div class="prop-row">Breite <input id="prop-width" type="number" min="0.2" step="0.05" value="${selected.width}"></div>        <div class="prop-row">Brüstung <input id="prop-sill" type="number" min="0" step="0.05" value="${selected.sillHeight}"></div>        <div class="prop-row">Höhe <input id="prop-height" type="number" min="0.2" step="0.05" value="${selected.height}"></div>        <button id="apply-props">Übernehmen</button>      `;
      document.getElementById("apply-props").onclick = () => {
        model.updateOpening(selected.id, {
          positionT: Number(document.getElementById("prop-t").value),
          width: Number(document.getElementById("prop-width").value),
          sillHeight: Number(document.getElementById("prop-sill").value),
          height: Number(document.getElementById("prop-height").value)
        });
        refreshAll();
      };
      return;
    }
    if (selected.type === "dimension") {
      this.propertiesPanel.innerHTML = `        <div class="prop-row"><span class="prop-label">Typ</span>: Bemaßung</div>        <div class="prop-row">Start X <input id="prop-start-x" type="number" step="0.1" value="${selected.start.x}"></div>        <div class="prop-row">Start Y <input id="prop-start-y" type="number" step="0.1" value="${selected.start.y}"></div>        <div class="prop-row">Ende X <input id="prop-end-x" type="number" step="0.1" value="${selected.end.x}"></div>        <div class="prop-row">Ende Y <input id="prop-end-y" type="number" step="0.1" value="${selected.end.y}"></div>        <div class="prop-row">Offset <input id="prop-offset" type="number" step="0.05" value="${selected.offset ?? 0.25}"></div>        <button id="apply-props">Übernehmen</button>      `;
      document.getElementById("apply-props").onclick = () => {
        model.updateDimension(selected.id, {
          start: {
            x: Number(document.getElementById("prop-start-x").value),
            y: Number(document.getElementById("prop-start-y").value)
          },
          end: {
            x: Number(document.getElementById("prop-end-x").value),
            y: Number(document.getElementById("prop-end-y").value)
          },
          offset: Number(document.getElementById("prop-offset").value)
        });
        refreshAll();
      };
      return;
    }
    this.propertiesPanel.innerHTML = "<div>Kein editierbares Objekt ausgewählt.</div>";
  },
  updateArea() {
    const total = model.rooms.reduce((sum, room) => sum + room.area, 0);
    const floorName = model.getCurrentFloor()?.name ?? "-";
    this.statusRight.textContent = `${floorName} · Fläche: ${total.toFixed(2)} m²`;
  }
};
const tools = new ToolController(model, renderer, ui);

function activateTool(tool) {
  ui.toolButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tool === tool);
  });
  tools.setTool(tool);
}

function refreshAll() {
  renderer.render();
  ui.updateArea();
  ui.updateProperties(model.selected);
  ui.refreshFloorList();
}
activateTool("select");
renderer.resize();
ui.refreshFloorList();
window.addEventListener("resize", () => renderer.resize());
ui.toolButtons.forEach(btn => {
  btn.addEventListener("click", () => activateTool(btn.dataset.tool));
});
ui.layerCheckboxes.forEach(input => {
  input.addEventListener("change", () => {
    model.saveHistory("toggleLayer");
    model.layers[input.dataset.layer] = input.checked;
    refreshAll();
  });
});
ui.snapToggle.addEventListener("change", () => {
  model.saveHistory("snapToggle");
  model.snapEnabled = ui.snapToggle.checked;
});
ui.gridSizeInput.addEventListener("change", () => {
  model.saveHistory("gridSize");
  model.gridSize = Math.max(0.1, Number(ui.gridSizeInput.value) || 0.5);
  refreshAll();
});
ui.wallThicknessInput.addEventListener("change", () => {
  model.saveHistory("wallThickness");
  model.wallThickness = Math.max(0.05, Number(ui.wallThicknessInput.value) || 0.2);
  refreshAll();
});
ui.catalogSelect.addEventListener("change", () => {
  tools.setCatalogItemById(tools.currentTool, ui.catalogSelect.value);
});
ui.floorSelect.addEventListener("change", () => {
  model.setCurrentFloor(ui.floorSelect.value);
  refreshAll();
});
document.getElementById("add-floor").addEventListener("click", () => {
  const name = prompt("Name der neuen Etage:", `Etage ${model.floors.length + 1}`);
  if (!name) return;
  model.createFloor(name);
  refreshAll();
});
document.getElementById("rename-floor").addEventListener("click", () => {
  const current = model.getCurrentFloor();
  if (!current) return;
  const name = prompt("Neuer Etagenname:", current.name);
  if (!name) return;
  model.renameCurrentFloor(name);
  refreshAll();
});
document.getElementById("delete-floor").addEventListener("click", () => {
  if (!confirm("Aktuelle Etage löschen?")) return;
  const ok = model.deleteCurrentFloor();
  if (ok) refreshAll();
});
document.getElementById("clear-all").addEventListener("click", () => {
  if (!confirm("Aktuelle Etage wirklich komplett löschen?")) return;
  model.clear();
  refreshAll();
});
document.getElementById("save-json").addEventListener("click", () => {
  const blob = new Blob([model.toJSON()], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "grundrissprojekt.json";
  a.click();
  URL.revokeObjectURL(url);
});
document.getElementById("load-json").addEventListener("click", () => {
  document.getElementById("file-input").click();
});
document.getElementById("file-input").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  model.loadFromJSON(text);
  ui.snapToggle.checked = model.snapEnabled;
  ui.gridSizeInput.value = model.gridSize;
  ui.wallThicknessInput.value = model.wallThickness;
  ui.layerCheckboxes.forEach(input => {
    input.checked = model.layers[input.dataset.layer];
  });
  refreshAll();
});
document.getElementById("export-png").addEventListener("click", () => {
  renderer.render();
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `${model.getCurrentFloor()?.name || "grundriss"}.png`;
  a.click();
});
document.getElementById("export-pdf").addEventListener("click", () => {
  renderer.render();
  exportCanvasToPDF(canvas, `${model.getCurrentFloor()?.name || "grundriss"}.pdf`);
});

function getWorldPointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  return renderer.screenToWorld({
    x,
    y
  });
}
canvas.addEventListener("dblclick", event => {
  const world = getWorldPointFromEvent(event);
  for (const room of model.rooms) {
    const minX = Math.min(...room.polygon.map(p => p.x));
    const maxX = Math.max(...room.polygon.map(p => p.x));
    const minY = Math.min(...room.polygon.map(p => p.y));
    const maxY = Math.max(...room.polygon.map(p => p.y));
    if (world.x >= minX && world.x <= maxX && world.y >= minY && world.y <= maxY) {
      const name = prompt("Raumname:", room.name || "");
      if (name) {
        model.renameRoom(room.id, name);
        refreshAll();
      }
      break;
    }
  }
});
canvas.addEventListener("mousedown", event => {
  tools.onMouseDown(getWorldPointFromEvent(event));
  ui.updateProperties(model.selected);
  ui.updateArea();
});
canvas.addEventListener("mousemove", event => {
  const world = getWorldPointFromEvent(event);
  tools.onMouseMove(world);
  ui.statusCenter.textContent = `Cursor: ${world.x.toFixed(2)} m / ${world.y.toFixed(2)} m`;
  ui.updateProperties(model.selected);
  ui.updateArea();
});
canvas.addEventListener("mouseup", event => {
  tools.onMouseUp(getWorldPointFromEvent(event));
  ui.updateProperties(model.selected);
  ui.updateArea();
});
canvas.addEventListener("mouseleave", () => {
  if (tools.currentTool !== "select") {
    tools.clearPreview();
  }
});
window.addEventListener("keydown", event => {
  const tag = document.activeElement?.tagName?.toLowerCase();
  const isTyping = tag === "input" || tag === "textarea";
  if ((event.key === "Delete" || event.key === "Backspace") && !isTyping) {
    const changed = model.deleteSelected();
    if (changed) refreshAll();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    if (event.shiftKey) {
      if (model.redo()) refreshAll();
    } else {
      if (model.undo()) refreshAll();
    }
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
    event.preventDefault();
    if (model.redo()) refreshAll();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d" && !isTyping) {
    event.preventDefault();
    const duplicated = model.duplicateSelected();
    if (duplicated) refreshAll();
    return;
  }
  if (!isTyping && (event.key === "q" || event.key === "Q")) {
    if (model.rotateSelected(-Math.PI / 12)) refreshAll();
    return;
  }
  if (!isTyping && (event.key === "e" || event.key === "E")) {
    if (model.rotateSelected(Math.PI / 12)) refreshAll();
    return;
  }
  if (!isTyping && event.key === "1") activateTool("select");
  if (!isTyping && event.key === "2") activateTool("wall");
  if (!isTyping && event.key === "3") activateTool("door");
  if (!isTyping && event.key === "4") activateTool("window");
  if (!isTyping && event.key === "5") activateTool("dimension");
  if (!isTyping && event.key === "6") activateTool("electrical");
  if (!isTyping && event.key === "7") activateTool("sanitary");
  if (!isTyping && event.key === "8") activateTool("heating");
  if (!isTyping && event.key === "9") activateTool("drywall");
});
refreshAll();