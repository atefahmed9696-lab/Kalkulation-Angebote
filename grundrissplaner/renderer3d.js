import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const WALL_HEIGHT = 2.5;
const FLOOR_THICKNESS = 0.05;

export class Renderer3D {
  constructor(canvas, model) {
    this.canvas = canvas;
    this.model = model;
    this._animId = null;
    this._built = false;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x1e1f24);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
    this.camera.position.set(10, 12, 14);
    this.camera.lookAt(5, 0, 5);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;

    this._setupLights();
    this._setupGrid();
  }

  _setupLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(15, 25, 10);
    sun.castShadow = true;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 40;
    sun.shadow.camera.bottom = -40;
    sun.shadow.mapSize.set(2048, 2048);
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0x8ab4f8, 0.3);
    fill.position.set(-10, 10, -5);
    this.scene.add(fill);
  }

  _setupGrid() {
    const grid = new THREE.GridHelper(100, 200, 0x3b4049, 0x2e3138);
    grid.position.y = -0.01;
    this.scene.add(grid);
  }

  /** Remove all previously built floor/wall/object meshes */
  _clearScene() {
    const toRemove = [];
    this.scene.traverse(child => {
      if (child.userData.floorMesh) toRemove.push(child);
    });
    toRemove.forEach(obj => {
      obj.geometry?.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => m.dispose());
      } else {
        obj.material?.dispose();
      }
      this.scene.remove(obj);
    });
  }

  /** Build Three.js meshes from the current model floor */
  buildScene() {
    this._clearScene();
    const floor = this.model.getCurrentFloor();
    if (!floor) return;

    const { walls, openings, objects, rooms } = floor;

    // --- Floor polygons (rooms) ---
    const floorMat = new THREE.MeshLambertMaterial({ color: 0xd4c5a9, side: THREE.DoubleSide });
    for (const room of rooms) {
      const shape = new THREE.Shape();
      room.polygon.forEach((p, i) => {
        if (i === 0) shape.moveTo(p.x, p.y);
        else shape.lineTo(p.x, p.y);
      });
      shape.closePath();
      const geo = new THREE.ShapeGeometry(shape);
      const mesh = new THREE.Mesh(geo, floorMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.receiveShadow = true;
      mesh.userData.floorMesh = true;
      this.scene.add(mesh);
    }

    // Pre-compute opening sets for quick lookup
    const openingsByWall = new Map();
    for (const op of openings) {
      if (!openingsByWall.has(op.wallId)) openingsByWall.set(op.wallId, []);
      openingsByWall.get(op.wallId).push(op);
    }

    // --- Walls ---
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x374151 });
    const drywallMat = new THREE.MeshLambertMaterial({ color: 0x7c3aed });

    for (const wall of walls) {
      if (!this.model.layers[wall.layer]) continue;

      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length < 1e-6) continue;

      const angle = Math.atan2(dy, dx);
      const cx = (wall.start.x + wall.end.x) / 2;
      const cy = (wall.start.y + wall.end.y) / 2;

      const mat = wall.layer === "drywall" ? drywallMat : wallMat;
      const wallOps = openingsByWall.get(wall.id) || [];

      if (wallOps.length === 0) {
        // Simple solid wall box
        const geo = new THREE.BoxGeometry(length, WALL_HEIGHT, wall.thickness);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(cx, WALL_HEIGHT / 2, cy);
        mesh.rotation.y = -angle;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.floorMesh = true;
        this.scene.add(mesh);
      } else {
        // Wall with openings — build segments
        this._buildWallWithOpenings(wall, wallOps, length, angle, cx, cy, mat);
      }
    }

    // --- Objects (Elektro, Sanitär, Heizung) ---
    for (const obj of objects) {
      if (!this.model.layers[obj.layer]) continue;
      const color = parseInt(obj.color.replace("#", "0x"), 16) || 0x60a5fa;
      const objMat = new THREE.MeshLambertMaterial({ color });
      const h = 0.6;
      const geo = new THREE.BoxGeometry(obj.width, h, obj.height);
      const mesh = new THREE.Mesh(geo, objMat);
      mesh.position.set(obj.x, h / 2, obj.y);
      mesh.rotation.y = -obj.rotation;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.floorMesh = true;
      this.scene.add(mesh);
    }
  }

  _buildWallWithOpenings(wall, ops, length, angle, cx, cy, mat) {
    // Sort openings along wall axis
    const sorted = [...ops].sort((a, b) => a.positionT - b.positionT);

    // Build list of segments: [start_t, end_t, type]
    // type: 'wall' | 'door' | 'window'
    const segments = [];
    let prev = 0;
    for (const op of sorted) {
      const opHalfT = (op.width / 2) / Math.max(length, 1e-6);
      const opStart = op.positionT - opHalfT;
      const opEnd = op.positionT + opHalfT;
      if (opStart > prev + 1e-4) {
        segments.push({ t0: prev, t1: opStart, type: "wall" });
      }
      segments.push({ t0: opStart, t1: opEnd, type: op.type, opening: op });
      prev = opEnd;
    }
    if (prev < 1 - 1e-4) {
      segments.push({ t0: prev, t1: 1, type: "wall" });
    }

    const doorMat = new THREE.MeshLambertMaterial({ color: 0x16a34a, transparent: true, opacity: 0.35 });
    const winMat = new THREE.MeshLambertMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.45 });

    for (const seg of segments) {
      const segLength = (seg.t1 - seg.t0) * length;
      if (segLength < 1e-4) continue;
      const segT = (seg.t0 + seg.t1) / 2;
      const localX = (segT - 0.5) * length;

      // Convert local wall coords to world
      const wx = cx + Math.cos(angle) * localX;
      const wz = cy + Math.sin(angle) * localX;

      let meshHeight = WALL_HEIGHT;
      let yOffset = WALL_HEIGHT / 2;
      let segMat = mat;

      if (seg.type === "door") {
        meshHeight = seg.opening.height ?? 2.1;
        yOffset = meshHeight / 2;
        segMat = doorMat;
      } else if (seg.type === "window") {
        const sill = seg.opening.sillHeight ?? 0.9;
        const winH = seg.opening.height ?? 1.2;
        meshHeight = winH;
        yOffset = sill + winH / 2;
        segMat = winMat;
        // Wall below window
        if (sill > 0.01) {
          const geo = new THREE.BoxGeometry(segLength, sill, wall.thickness);
          const m = new THREE.Mesh(geo, mat);
          m.position.set(wx, sill / 2, wz);
          m.rotation.y = -angle;
          m.castShadow = true;
          m.receiveShadow = true;
          m.userData.floorMesh = true;
          this.scene.add(m);
        }
        // Wall above window
        const top = sill + winH;
        if (top < WALL_HEIGHT - 0.01) {
          const aboveH = WALL_HEIGHT - top;
          const geo = new THREE.BoxGeometry(segLength, aboveH, wall.thickness);
          const m = new THREE.Mesh(geo, mat);
          m.position.set(wx, top + aboveH / 2, wz);
          m.rotation.y = -angle;
          m.castShadow = true;
          m.receiveShadow = true;
          m.userData.floorMesh = true;
          this.scene.add(m);
        }
      }

      const geo = new THREE.BoxGeometry(segLength, meshHeight, wall.thickness);
      const mesh = new THREE.Mesh(geo, segMat);
      mesh.position.set(wx, yOffset, wz);
      mesh.rotation.y = -angle;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.floorMesh = true;
      this.scene.add(mesh);
    }
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || this.canvas.clientWidth || 800;
    const h = rect.height || this.canvas.clientHeight || 600;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  startLoop() {
    if (this._animId !== null) return;
    const animate = () => {
      this._animId = requestAnimationFrame(animate);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  stopLoop() {
    if (this._animId !== null) {
      cancelAnimationFrame(this._animId);
      this._animId = null;
    }
  }

  /** Call whenever the model changes while in 3D mode */
  update() {
    this.buildScene();
  }
}
