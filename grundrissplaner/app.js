import { FloorPlanModel }  from "./model.js";
import { Renderer }        from "./renderer.js";
import { ToolController }  from "./tools.js";

const canvas = document.getElementById("canvas");
const model  = new FloorPlanModel();
const renderer = new Renderer(canvas, model);

// --- UI-Objekt -----------------------------------------------------------

const ui = {
  toolButtons:       [...document.querySelectorAll(".tool-btn")],
  layerCheckboxes:   [...document.querySelectorAll("[data-layer]")],
  snapToggle:        document.getElementById("snap-toggle"),
  gridSizeInput:     document.getElementById("grid-size"),
  wallThicknessInput:document.getElementById("wall-thickness"),
  catalogSelect:     document.getElementById("catalog-select"),
  propertiesPanel:   document.getElementById("properties-panel"),
  statusLeft:        document.getElementById("status-left"),
  statusCenter:      document.getElementById("status-center"),
  statusRight:       document.getElementById("status-right"),
  undoBtn:           document.getElementById("undo-btn"),
  redoBtn:           document.getElementById("redo-btn"),

  setStatusTool(tool) {
    const names = {
      select: "Auswahl", wall: "Wand", door: "Tür", window: "Fenster",
      electrical: "Elektro", sanitary: "Sanitär", heating: "Heizung",
      drywall: "Trockenbau", furniture: "Möbel"
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
      opt.value       = item.id;
      opt.textContent = item.name;
      if (item.id === selectedId) opt.selected = true;
      this.catalogSelect.appendChild(opt);
    }
  },

  updateProperties(selected) {
    if (!selected) {
      this.propertiesPanel.innerHTML = "<div>Kein Objekt ausgewählt.</div>";
      return;
    }

    if (selected.type === "wall") {
      this.propertiesPanel.innerHTML = `
        <div class="prop-row"><span class="prop-label">Typ</span>: Wand</div>
        <div class="prop-row">Start X <input id="prop-sx" type="number" step="0.1" value="${selected.start.x.toFixed(2)}"></div>
        <div class="prop-row">Start Y <input id="prop-sy" type="number" step="0.1" value="${selected.start.y.toFixed(2)}"></div>
        <div class="prop-row">Ende X  <input id="prop-ex" type="number" step="0.1" value="${selected.end.x.toFixed(2)}"></div>
        <div class="prop-row">Ende Y  <input id="prop-ey" type="number" step="0.1" value="${selected.end.y.toFixed(2)}"></div>
        <div class="prop-row">Stärke  <input id="prop-th" type="number" min="0.05" step="0.01" value="${selected.thickness}"></div>
        <button id="apply-props">Übernehmen</button>
      `;
      document.getElementById("apply-props").onclick = () => {
        model.updateWall(selected.id, {
          start: {
            x: Number(document.getElementById("prop-sx").value),
            y: Number(document.getElementById("prop-sy").value)
          },
          end: {
            x: Number(document.getElementById("prop-ex").value),
            y: Number(document.getElementById("prop-ey").value)
          },
          thickness: Number(document.getElementById("prop-th").value)
        });
        refreshAll();
      };
      return;
    }

    if (selected.type === "object") {
      this.propertiesPanel.innerHTML = `
        <div class="prop-row"><span class="prop-label">Typ</span>: ${selected.name}</div>
        <div class="prop-row">Name   <input id="prop-name" type="text" value="${selected.name}"></div>
        <div class="prop-row">X      <input id="prop-x" type="number" step="0.1" value="${selected.x.toFixed(2)}"></div>
        <div class="prop-row">Y      <input id="prop-y" type="number" step="0.1" value="${selected.y.toFixed(2)}"></div>
        <div class="prop-row">Breite <input id="prop-w" type="number" min="0.05" step="0.05" value="${selected.width}"></div>
        <div class="prop-row">Höhe   <input id="prop-h" type="number" min="0.05" step="0.05" value="${selected.height}"></div>
        <div class="prop-row">Rotation <input id="prop-rot" type="number" step="0.1" value="${(selected.rotation * 180 / Math.PI).toFixed(1)}"> °</div>
        <button id="apply-props">Übernehmen</button>
      `;
      document.getElementById("apply-props").onclick = () => {
        model.updateObject(selected.id, {
          name:     document.getElementById("prop-name").value,
          x:        Number(document.getElementById("prop-x").value),
          y:        Number(document.getElementById("prop-y").value),
          width:    Number(document.getElementById("prop-w").value),
          height:   Number(document.getElementById("prop-h").value),
          rotation: Number(document.getElementById("prop-rot").value) * Math.PI / 180
        });
        refreshAll();
      };
      return;
    }

    if (selected.type === "door" || selected.type === "window") {
      this.propertiesPanel.innerHTML = `
        <div class="prop-row"><span class="prop-label">Typ</span>: ${selected.type === "door" ? "Tür" : "Fenster"}</div>
        <div class="prop-row">Position t <input id="prop-t" type="number" min="0.05" max="0.95" step="0.01" value="${selected.positionT.toFixed(3)}"></div>
        <div class="prop-row">Breite     <input id="prop-w" type="number" min="0.2" step="0.05" value="${selected.width}"></div>
        <div class="prop-row">Brüstung   <input id="prop-sill" type="number" min="0" step="0.05" value="${selected.sillHeight}"></div>
        <div class="prop-row">Höhe       <input id="prop-h" type="number" min="0.2" step="0.05" value="${selected.height}"></div>
        <button id="apply-props">Übernehmen</button>
      `;
      document.getElementById("apply-props").onclick = () => {
        model.updateOpening(selected.id, {
          positionT:  Number(document.getElementById("prop-t").value),
          width:      Number(document.getElementById("prop-w").value),
          sillHeight: Number(document.getElementById("prop-sill").value),
          height:     Number(document.getElementById("prop-h").value)
        });
        refreshAll();
      };
      return;
    }

    this.propertiesPanel.innerHTML = "<div>Kein editierbares Objekt ausgewählt.</div>";
  },

  updateArea() {
    const total = model.rooms.reduce((sum, r) => sum + r.area, 0);
    this.statusRight.textContent = `Fläche: ${total.toFixed(2)} m²`;
  },

  updateUndoRedo() {
    if (this.undoBtn) this.undoBtn.disabled = !model.canUndo;
    if (this.redoBtn) this.redoBtn.disabled = !model.canRedo;
  }
};

// --- ToolController -------------------------------------------------------

const tools = new ToolController(model, renderer, ui);

// --- Hilfsfunktionen -------------------------------------------------------

function activateTool(tool) {
  ui.toolButtons.forEach(btn =>
    btn.classList.toggle("active", btn.dataset.tool === tool)
  );
  tools.setTool(tool);
}

function refreshAll() {
  renderer.render();
  ui.updateArea();
  ui.updateProperties(model.selected);
  ui.updateUndoRedo();
}

function getWorldPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return renderer.screenToWorld({
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  });
}

// --- Init ------------------------------------------------------------------

activateTool("select");
renderer.resize();

// --- Fenster-Resize -------------------------------------------------------

window.addEventListener("resize", () => renderer.resize());

// --- Werkzeug-Buttons -----------------------------------------------------

ui.toolButtons.forEach(btn =>
  btn.addEventListener("click", () => activateTool(btn.dataset.tool))
);

// --- Layer-Checkboxen -----------------------------------------------------

ui.layerCheckboxes.forEach(input =>
  input.addEventListener("change", () => {
    model.layers[input.dataset.layer] = input.checked;
    refreshAll();
  })
);

// --- Einstellungen --------------------------------------------------------

ui.snapToggle.addEventListener("change", () => {
  model.snapEnabled = ui.snapToggle.checked;
});

ui.gridSizeInput.addEventListener("change", () => {
  model.gridSize = Math.max(0.1, Number(ui.gridSizeInput.value) || 0.5);
  refreshAll();
});

ui.wallThicknessInput.addEventListener("change", () => {
  model.wallThickness = Math.max(0.05, Number(ui.wallThicknessInput.value) || 0.2);
  refreshAll();
});

ui.catalogSelect.addEventListener("change", () => {
  tools.setCatalogItemById(tools.currentTool, ui.catalogSelect.value);
});

// --- Undo / Redo Buttons --------------------------------------------------

document.getElementById("undo-btn")?.addEventListener("click", () => {
  if (model.undo()) refreshAll();
});

document.getElementById("redo-btn")?.addEventListener("click", () => {
  if (model.redo()) refreshAll();
});

// --- Aktions-Buttons -------------------------------------------------------

document.getElementById("clear-all").addEventListener("click", () => {
  if (!confirm("Wirklich alles löschen?")) return;
  model.clear();
  refreshAll();
});

document.getElementById("save-json").addEventListener("click", () => {
  const blob = new Blob([model.toJSON()], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "grundrissprojekt.json";
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("load-json").addEventListener("click", () => {
  document.getElementById("file-input").click();
});

document.getElementById("file-input").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  model.loadFromJSON(text);
  ui.snapToggle.checked     = model.snapEnabled;
  ui.gridSizeInput.value    = model.gridSize;
  ui.wallThicknessInput.value = model.wallThickness;
  ui.layerCheckboxes.forEach(input => {
    input.checked = model.layers[input.dataset.layer];
  });
  refreshAll();
});

document.getElementById("export-png").addEventListener("click", () => {
  renderer.render();
  const url = canvas.toDataURL("image/png");
  const a   = document.createElement("a");
  a.href    = url;
  a.download = "grundriss.png";
  a.click();
});

// --- Canvas-Events --------------------------------------------------------

canvas.addEventListener("mousedown", event => {
  tools.onMouseDown(getWorldPoint(event), event.shiftKey);
  refreshAll();
});

canvas.addEventListener("mousemove", event => {
  const world = getWorldPoint(event);
  tools.onMouseMove(world, event.shiftKey);
  ui.statusCenter.textContent = `${world.x.toFixed(2)} m / ${world.y.toFixed(2)} m`;
  ui.updateProperties(model.selected);
  ui.updateArea();
});

canvas.addEventListener("mouseup", event => {
  tools.onMouseUp(getWorldPoint(event), event.shiftKey);
  refreshAll();
});

canvas.addEventListener("mouseleave", () => {
  if (tools.currentTool !== "select") tools.clearPreview();
});

// --- Tastatur-Shortcuts ---------------------------------------------------

window.addEventListener("keydown", event => {
  const tag      = document.activeElement?.tagName?.toLowerCase();
  const isTyping = tag === "input" || tag === "textarea" || tag === "select";

  // Entfernen: Entf / Backspace
  if ((event.key === "Delete" || event.key === "Backspace") && !isTyping) {
    if (model.deleteSelected()) refreshAll();
    return;
  }

  // Undo: Strg+Z
  if (event.key === "z" && (event.ctrlKey || event.metaKey) && !event.shiftKey) {
    event.preventDefault();
    if (model.undo()) refreshAll();
    return;
  }

  // Redo: Strg+Y oder Strg+Shift+Z
  if (
    (event.key === "y" && (event.ctrlKey || event.metaKey)) ||
    (event.key === "z" && (event.ctrlKey || event.metaKey) && event.shiftKey)
  ) {
    event.preventDefault();
    if (model.redo()) refreshAll();
    return;
  }

  // Werkzeug-Shortcuts
  if (!isTyping) {
    const shortcuts = {
      "s": "select",
      "w": "wall",
      "d": "door",
      "f": "window",  // Fenster
      "e": "electrical",
      "b": "sanitary",
      "h": "heating",
      "m": "furniture"
    };
    if (shortcuts[event.key]) {
      activateTool(shortcuts[event.key]);
    }
  }
});

refreshAll();
