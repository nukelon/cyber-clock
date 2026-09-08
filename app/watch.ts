import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import {
  CASE_PROFILES,
  caseShell,
  EXPLOSION_SPACING,
  ViewTransition,
  viewPose,
  reflectionShader,
} from './presentation';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  Movement,
  PARTS,
  TRAIN,
  TAU,
  type PartKey,
  type Snapshot,
} from './mechanism';

type Hooks = {
  onSnapshot?: (v: Snapshot) => void;
  onSelect?: (v: PartKey | null) => void;
  onHover?: (v: { key: PartKey; x: number; y: number } | null) => void;
  onWind?: (full: boolean) => void;
  onError?: (s: string) => void;
};
const polar = (r: number, a: number) =>
  new THREE.Vector2(r * Math.cos(a), r * Math.sin(a));
function gearGeometry(
  n: number,
  m: number,
  depth: number,
  open = true,
  escape = false,
) {
  const pitch = (n * m) / 2,
    root = Math.max(m * 0.6, pitch - 1.25 * m),
    tip = pitch + m,
    base = pitch * Math.cos(Math.PI / 9),
    shape = new THREE.Shape();
  const inv = (a: number) => Math.tan(a) - a,
    half = Math.PI / (2 * n),
    points: THREE.Vector2[] = [];
  for (let i = 0; i < n; i++) {
    const c = (i * TAU) / n;
    if (escape) {
      for (const [a, r] of [
        [-0.48, root],
        [0.02, root],
        [0.24, tip],
        [0.34, tip],
        [0.22, root],
      ] as number[][])
        points.push(polar(r, c + (a * TAU) / n));
      continue;
    }
    const flank = (r: number) =>
      half + inv(Math.PI / 9) - inv(Math.acos(Math.min(1, base / r)));
    points.push(
      polar(root, c - Math.PI / n),
      polar(root, c - flank(Math.max(base, root))),
    );
    for (let j = 0; j <= 4; j++) {
      const r = Math.max(base, root) + ((tip - Math.max(base, root)) * j) / 4;
      points.push(polar(r, c - flank(r)));
    }
    for (let j = 4; j >= 0; j--) {
      const r = Math.max(base, root) + ((tip - Math.max(base, root)) * j) / 4;
      points.push(polar(r, c + flank(r)));
    }
    points.push(
      polar(root, c + flank(Math.max(base, root))),
      polar(root, c + Math.PI / n),
    );
  }
  shape.setFromPoints(points);
  shape.closePath();
  if (open && pitch > 0.2) {
    const arms = n === 15 ? 4 : 5;
    for (let i = 0; i < arms; i++) {
      const a = (i * TAU) / arms + 0.14,
        b = ((i + 1) * TAU) / arms - 0.14,
        hole = new THREE.Path();
      hole.absarc(0, 0, root * 0.87, a, b, false);
      hole.absarc(0, 0, Math.max(0.09, pitch * 0.24), b, a, true);
      hole.closePath();
      shape.holes.push(hole);
    }
  }
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: Math.min(0.006, m * 0.12),
    bevelThickness: 0.004,
    curveSegments: 12,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}
function annulus(outer: number, inner: number, depth: number) {
  const s = new THREE.Shape();
  s.absarc(0, 0, outer, 0, TAU, false);
  const h = new THREE.Path();
  h.absarc(0, 0, inner, 0, TAU, true);
  s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelSize: 0.008,
    bevelThickness: 0.008,
    bevelSegments: 2,
    curveSegments: 100,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}
function plateShape(points: number[][], depth: number) {
  const shape = new THREE.Shape(
    points.map((p) => new THREE.Vector2(p[0], p[1])),
  );
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.025,
    bevelThickness: 0.016,
    curveSegments: 24,
  });
}
function cylinderZ(r: number, h: number) {
  const g = new THREE.CylinderGeometry(r, r, h, 48);
  g.rotateX(Math.PI / 2);
  return g;
}
function lineGeometry(points: THREE.Vector3[], r = 0.012) {
  return new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points),
    Math.max(12, points.length * 3),
    r,
    6,
    false,
  );
}

export function createWatch(container: HTMLElement, hooks: Hooks = {}) {
  RectAreaLightUniformsLib.init();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 150);
  camera.position.set(0.4, -2.1, 12.7);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute(
    'aria-label',
    '交互式机械腕表；方向键旋转，加减号缩放，W 上链',
  );
  container.prepend(renderer.domElement);
  const pmrem = new THREE.PMREMGenerator(renderer),
    env = new RoomEnvironment(),
    envTarget = pmrem.fromScene(env, 0.025);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 1.1;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.enablePan = false;
  controls.minDistance = 6.3;
  controls.maxDistance = 90;
  controls.rotateSpeed = 0.65;
  controls.target.set(0, 0, 0);
  controls.autoRotateSpeed = 0.5;
  const transition = new ViewTransition(camera, controls);
  const cancelViewTransition = () => transition.cancel();
  controls.addEventListener('start', cancelViewTransition);
  const movement = new Movement();
  const makeMat = (color: number, metalness = 1, roughness = 0.25) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const silver = makeMat(0xd3d9d9, 1, 0.18),
    brushed = makeMat(0x8a999c, 1, 0.36),
    gold = makeMat(0xcfab5e, 1, 0.27),
    brightGold = makeMat(0xe2c78d, 1, 0.19),
    rhodium = makeMat(0x303938, 0.98, 0.31),
    dark = makeMat(0x101919, 0.85, 0.4),
    blue = makeMat(0x102f74, 0.88, 0.19),
    springMat = makeMat(0xa1aca2, 0.94, 0.31);
  springMat.side = THREE.DoubleSide;
  const ruby = new THREE.MeshPhysicalMaterial({
    color: 0x8d0c39,
    metalness: 0.3,
    roughness: 0.13,
    clearcoat: 1,
    transmission: 0.2,
    thickness: 0.08,
    ior: 1.76,
  });
  const lume = new THREE.MeshStandardMaterial({
    color: 0xd4efe2,
    emissive: 0x6fbfae,
    emissiveIntensity: 0.25,
    roughness: 0.38,
    metalness: 0.1,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xd5efff,
    metalness: 0,
    roughness: 0.025,
    transmission: 1,
    transparent: true,
    opacity: 0.15,
    ior: 1.76,
    thickness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.025,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const leather = new THREE.MeshStandardMaterial({
    color: 0x0d1715,
    roughness: 0.86,
    metalness: 0,
  });
  // Deterministic micro-grain for brushed metal and leather, not external image assets.
  const grainCanvas = document.createElement('canvas');
  grainCanvas.width = 256;
  grainCanvas.height = 256;
  const gc = grainCanvas.getContext('2d')!;
  const pixels = gc.createImageData(256, 256);
  let seed = 41;
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const v = (seed % 80) + 90;
    pixels.data.set([v, v, v, 255], i);
  }
  gc.putImageData(pixels, 0, 0);
  const grain = new THREE.CanvasTexture(grainCanvas);
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(3, 3);
  leather.bumpMap = grain;
  leather.bumpScale = 0.035;
  leather.needsUpdate = true;
  const watch = new THREE.Group();
  watch.rotation.set(0.08, -0.2, -0.19);
  scene.add(watch);
  const groups = {} as Record<PartKey, THREE.Group>;
  for (const key of Object.keys(PARTS) as PartKey[]) {
    groups[key] = new THREE.Group();
    groups[key].userData.part = key;
    watch.add(groups[key]);
  }
  const pickable: THREE.Object3D[] = [];
  const explodeNodes: { node: THREE.Object3D; base: number; factor: number }[] =
    [];
  const mesh = (
    g: THREE.BufferGeometry,
    mat: THREE.Material,
    parent: THREE.Object3D,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    const o = new THREE.Mesh(g, mat);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  const ring = (
    r: number,
    t: number,
    parent: THREE.Object3D,
    mat: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
  ) => mesh(new THREE.TorusGeometry(r, t, 12, 128), mat, parent, x, y, z);
  const layer = (node: THREE.Object3D, factor: number) => {
    explodeNodes.push({ node, base: node.position.z, factor });
    return node;
  };
  function batch(
    geometries: THREE.BufferGeometry[],
    mat: THREE.Material,
    parent: THREE.Object3D,
  ) {
    const merged = mergeGeometries(geometries);
    geometries.forEach((g) => g.dispose());
    return merged ? mesh(merged, mat, parent) : null;
  }
  function bar(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    z: number,
    w: number,
    mat: THREE.Material,
    parent: THREE.Object3D,
  ) {
    const length = Math.hypot(x2 - x1, y2 - y1),
      o = mesh(
        new THREE.BoxGeometry(w, length, 0.05),
        mat,
        parent,
        (x1 + x2) / 2,
        (y1 + y2) / 2,
        z,
      );
    o.rotation.z = -Math.atan2(x2 - x1, y2 - y1);
    return o;
  }
  function jewel(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    size = 0.051,
  ) {
    mesh(cylinderZ(size * 1.7, 0.018), gold, parent, x, y, z - 0.009);
    mesh(cylinderZ(size, 0.027), ruby, parent, x, y, z + 0.008);
    mesh(cylinderZ(size * 0.2, 0.033), silver, parent, x, y, z + 0.015);
  }
  function screw(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    r = 0.059,
  ) {
    mesh(cylinderZ(r * 1.25, 0.027), silver, parent, x, y, z - 0.015);
    mesh(cylinderZ(r, 0.027), blue, parent, x, y, z);
    const slot = mesh(
      new THREE.BoxGeometry(r * 1.5, 0.015, 0.007),
      dark,
      parent,
      x,
      y,
      z + 0.016,
    );
    slot.rotation.z = x * 1.7 + y;
  }
  // Case: separate mid-case, polished bezels, front crystal and exhibition back.
  const caseGroup = groups.crystal;
  mesh(caseShell(CASE_PROFILES.middle), brushed, caseGroup);
  ring(2.49, 0.025, caseGroup, silver, 0, 0, 0.2);
  const bezel = new THREE.Group();
  caseGroup.add(bezel);
  layer(bezel, 3.0);
  mesh(caseShell(CASE_PROFILES.bezel), silver, bezel);
  ring(2.3, 0.026, bezel, silver, 0, 0, 0.79);
  ring(2.255, 0.014, bezel, brightGold, 0, 0, 0.765);
  const backBezel = new THREE.Group();
  caseGroup.add(backBezel);
  layer(backBezel, -2.1);
  mesh(caseShell(CASE_PROFILES.back), silver, backBezel);
  ring(2.42, 0.016, backBezel, rhodium, 0, 0, -0.47);
  const frontGlass = layer(
    mesh(cylinderZ(2.25, 0.052), glassMat, caseGroup, 0, 0, 0.8),
    3.25,
  );
  frontGlass.castShadow = false;
  frontGlass.renderOrder = 4;
  frontGlass.userData.ignorePick = true;
  const backGlass = layer(
    mesh(cylinderZ(2.18, 0.036), glassMat, caseGroup, 0, 0, -0.56),
    -2.3,
  );
  backGlass.castShadow = false;
  backGlass.userData.ignorePick = true;
  for (const side of [-1, 1]) {
    for (const x of [-0.97, 0.97]) {
      const lug = mesh(
        plateShape(
          [
            [x - 0.16, side * 1.93],
            [x + 0.16, side * 1.93],
            [x + 0.19, side * 2.85],
            [x - 0.13, side * 2.88],
          ],
          0.3,
        ),
        brushed,
        caseGroup,
        0,
        0,
        -0.15,
      );
      lug.rotation.x = side * 0.035;
      ring(0.066, 0.025, caseGroup, silver, x, side * 2.67, 0.17);
      screw(caseGroup, x, side * 2.69, 0.2, 0.049);
    }
    const strap = mesh(
      plateShape(
        [
          [-0.86, side * 2.48],
          [0.86, side * 2.48],
          [0.78, side * 3.56],
          [-0.78, side * 3.56],
        ],
        0.12,
      ),
      leather,
      caseGroup,
      0,
      0,
      -0.18,
    );
    strap.receiveShadow = true;
    const stitches: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 14; i++)
      for (const x of [-0.74, 0.74]) {
        const g = new THREE.BoxGeometry(0.018, 0.038, 0.018);
        g.translate(x, side * (2.62 + i * 0.061), -0.042);
        stitches.push(g);
      }
    batch(stitches, makeMat(0x475447, 0.1, 0.9), caseGroup);
  }
  // Fixed chapter ring and luminous indices.
  const chapter = new THREE.Group();
  groups.hands.add(chapter);
  chapter.position.z = 0.46;
  layer(chapter, 2.05);
  mesh(annulus(2.225, 1.97, 0.045), dark, chapter);
  const tickGeoms: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 120; i++) {
    const a = (i * TAU) / 120,
      len = i % 10 === 0 ? 0.19 : i % 2 === 0 ? 0.093 : 0.044,
      r = 2.12 - len / 2;
    const g = new THREE.BoxGeometry(i % 10 === 0 ? 0.033 : 0.009, len, 0.023);
    g.rotateZ(-a);
    g.translate(r * Math.sin(a), r * Math.cos(a), 0.04);
    tickGeoms.push(g);
  }
  batch(tickGeoms, silver, chapter);
  for (let i = 0; i < 12; i++) {
    const a = (i * TAU) / 12,
      r = 2.015;
    for (const offset of i === 0 ? [-0.049, 0.049] : [0]) {
      const marker = mesh(
        new THREE.BoxGeometry(0.068, 0.205, 0.062),
        silver,
        chapter,
        r * Math.sin(a) + offset * Math.cos(a),
        r * Math.cos(a) - offset * Math.sin(a),
        0.037,
      );
      marker.rotation.z = -a;
      const inset = mesh(
        new THREE.BoxGeometry(0.039, 0.16, 0.014),
        lume,
        chapter,
        r * Math.sin(a) + offset * Math.cos(a),
        r * Math.cos(a) - offset * Math.sin(a),
        0.075,
      );
      inset.rotation.z = -a;
    }
  }
  function textPlate(
    text: string,
    width: number,
    height: number,
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    font = 44,
    color = '#bbc8b2',
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 160;
    const c = canvas.getContext('2d')!;
    c.clearRect(0, 0, 1024, 160);
    c.fillStyle = color;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `${font}px Georgia`;
    c.fillText(text, 512, 80);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    return mesh(new THREE.PlaneGeometry(width, height), m, parent, x, y, z);
  }
  textPlate('N O C T U R N E', 1.28, 0.21, chapter, 0, 1.7, 0.059, 57);
  textPlate('M A N U E L   •   3  H z', 1.2, 0.15, chapter, 0, -1.74, 0.06, 40);
  for (const [text, x, y] of [
    ['15', 2.15, 0],
    ['30', 0, -2.17],
    ['45', -2.15, 0],
  ] as [string, number, number][])
    textPlate(text, 0.22, 0.09, chapter, x, y, 0.065, 64);
  // Open mainplate: perimeter, bearing lands and machined radial ribs.
  const base = new THREE.Group();
  groups.bridges.add(base);
  base.position.z = -0.38;
  layer(base, -1.2);
  mesh(annulus(2.19, 1.98, 0.09), rhodium, base);
  const backRibs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i * TAU) / 10;
    const g = new THREE.BoxGeometry(0.13, 0.75, 0.065);
    g.rotateZ(-a);
    g.translate(1.75 * Math.sin(a), 1.75 * Math.cos(a), 0.005);
    backRibs.push(g);
  }
  batch(backRibs, rhodium, base);
  for (const g of TRAIN) {
    const a = Math.atan2(g.y, g.x);
    bar(
      g.x,
      g.y,
      1.98 * Math.cos(a),
      1.98 * Math.sin(a),
      0.015,
      0.12,
      rhodium,
      base,
    );
    mesh(cylinderZ(0.115, 0.065), rhodium, base, g.x, g.y, 0.03);
    jewel(base, g.x, g.y, 0.087, 0.045);
  }
  const perlages: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 88; i++) {
    const a = (i * TAU) / 88;
    const g = new THREE.TorusGeometry(0.041, 0.002, 4, 16);
    g.translate(2.085 * Math.cos(a), 2.085 * Math.sin(a), 0.057);
    perlages.push(g);
  }
  batch(perlages, brushed, base);
  // Going train; each wheel and its pinion share a rigid arbor.
  const wheels: THREE.Group[] = [];
  TRAIN.forEach((spec, i) => {
    const key: PartKey = i === 0 ? 'barrel' : i === 4 ? 'escapement' : 'train';
    const assembly = new THREE.Group();
    assembly.position.set(spec.x, spec.y, 0);
    groups[key].add(assembly);
    layer(assembly, i === 0 ? -0.25 : 0.15 + i * 0.26);
    wheels.push(assembly);
    const wheel = mesh(
      gearGeometry(
        spec.wheel,
        spec.module,
        i === 0 ? 0.11 : 0.045,
        i !== 0,
        i === 4,
      ),
      i === 4 ? brightGold : gold,
      assembly,
      0,
      0,
      spec.z,
    );
    wheel.userData.name = spec.name;
    if (i > 0) {
      const prev = TRAIN[i - 1];
      mesh(
        gearGeometry(spec.pinion, prev.module, 0.1, false),
        silver,
        assembly,
        0,
        0,
        prev.z,
      );
      const shaftTop = i === 1 ? 0.735 : i === 3 ? 0.625 : 0.45,
        shaftBottom = -0.42;
      mesh(
        cylinderZ(0.023, shaftTop - shaftBottom),
        silver,
        assembly,
        0,
        0,
        (shaftTop + shaftBottom) / 2,
      );
      ring(
        spec.wheel * spec.module * 0.38,
        0.008,
        assembly,
        brightGold,
        0,
        0,
        spec.z + 0.027,
      );
    }
    mesh(
      cylinderZ(i === 0 ? 0.075 : 0.059, 0.095),
      silver,
      assembly,
      0,
      0,
      spec.z + 0.05,
    );
  });
  const barrel = TRAIN[0],
    barrelR = (barrel.wheel * barrel.module) / 2;
  // Replace opaque barrel disk with cutaway drum and a genuinely separate spring/arbor.
  const barrelDisk = wheels[0].children[0] as THREE.Mesh;
  barrelDisk.geometry.dispose();
  barrelDisk.geometry = gearGeometry(96, barrel.module, 0.08, true);
  mesh(
    annulus(barrelR * 0.94, barrelR * 0.88, 0.28),
    brushed,
    wheels[0],
    0,
    0,
    -0.04,
  );
  mesh(
    annulus(barrelR * 0.89, barrelR * 0.85, 0.018),
    brightGold,
    wheels[0],
    0,
    0,
    0.112,
  );
  const springGeo = new THREE.BufferGeometry(),
    springCount = 640,
    springVertices = new Float32Array((springCount + 1) * 6),
    springIndices: number[] = [];
  for (let i = 0; i < springCount; i++) {
    const k = i * 2;
    springIndices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
  }
  springGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(springVertices, 3).setUsage(
      THREE.DynamicDrawUsage,
    ),
  );
  springGeo.setIndex(springIndices);
  const springMesh = mesh(
    springGeo,
    springMat,
    groups.barrel,
    barrel.x,
    barrel.y,
    0.105,
  );
  layer(springMesh, -0.15);
  const arbor = new THREE.Group();
  arbor.position.set(barrel.x, barrel.y, 0.46);
  groups.crown.add(arbor);
  layer(arbor, 1.5);
  mesh(gearGeometry(48, 0.03, 0.045, true), brushed, arbor);
  ring(0.625, 0.01, arbor, silver, 0, 0, 0.027);
  mesh(cylinderZ(0.068, 0.73), silver, arbor, 0, 0, -0.29);
  screw(arbor, 0, 0, 0.055, 0.083);
  const crownWheel = new THREE.Group();
  crownWheel.position.set(barrel.x + 1.26, barrel.y, 0.46);
  groups.crown.add(crownWheel);
  layer(crownWheel, 1.5);
  mesh(gearGeometry(36, 0.03, 0.055, true), silver, crownWheel);
  ring(0.42, 0.012, crownWheel, brightGold, 0, 0, 0.045);
  screw(crownWheel, 0, 0, 0.082, 0.07);
  // Face/crown teeth at right angles to the winding stem (not planar spur teeth).
  const faceTeeth: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 36; i++) {
    const a = (i * TAU) / 36,
      g = new THREE.BoxGeometry(0.032, 0.095, 0.045);
    g.rotateZ(-a);
    g.translate(0.445 * Math.sin(a), 0.445 * Math.cos(a), 0.059);
    faceTeeth.push(g);
  }
  batch(faceTeeth, brushed, crownWheel);
  const stem = new THREE.Group();
  stem.position.set(0.95, barrel.y, 0.53);
  groups.crown.add(stem);
  layer(stem, 1.5);
  const stemShaft = mesh(cylinderZ(0.038, 1.72), silver, stem, 0.8, 0, 0);
  stemShaft.rotation.y = Math.PI / 2;
  const bevelPinion = mesh(
    gearGeometry(12, 0.023, 0.1, false),
    silver,
    stem,
    0.025,
    0,
    0,
  );
  bevelPinion.rotation.y = Math.PI / 2;
  const crown = new THREE.Group();
  crown.position.set(1.82, 0, 0);
  crown.userData.windHandle = true;
  stem.add(crown);
  const collar = mesh(cylinderZ(0.066, 0.2), silver, stem, 1.66, 0, 0);
  collar.rotation.y = Math.PI / 2;
  const crownBody = mesh(
    new THREE.CylinderGeometry(0.215, 0.215, 0.32, 64),
    silver,
    crown,
  );
  crownBody.rotation.z = Math.PI / 2;
  const crownCap = mesh(cylinderZ(0.175, 0.018), rhodium, crown, 0.17);
  crownCap.rotation.y = Math.PI / 2;
  const knurls: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 40; i++) {
    const a = (i * TAU) / 40,
      g = new THREE.BoxGeometry(0.285, 0.018, 0.022);
    g.rotateX(a);
    g.translate(0, 0.215 * Math.cos(a), 0.215 * Math.sin(a));
    knurls.push(g);
  }
  batch(knurls, brushed, crown);
  // Ratchet click and its visible return spring.
  const click = new THREE.Group();
  click.position.set(barrel.x - 0.57, barrel.y + 0.52, 0.5);
  groups.crown.add(click);
  layer(click, 1.5);
  mesh(
    plateShape(
      [
        [-0.2, 0.09],
        [-0.15, -0.07],
        [0.13, -0.06],
        [0.18, 0.03],
        [0.1, 0.12],
      ],
      0.026,
    ),
    blue,
    click,
  );
  screw(click, -0.12, 0.02, 0.057, 0.038);
  const clickSpring = mesh(
    lineGeometry([
      new THREE.Vector3(barrel.x - 0.7, barrel.y + 0.59, 0.51),
      new THREE.Vector3(-1.8, 1.65, 0.51),
      new THREE.Vector3(-1.88, 1.13, 0.51),
    ]),
    springMat,
    groups.crown,
  );
  layer(clickSpring, 1.5);
  // Balance with timing screws, roller and breathing hairspring.
  const bx = -0.88,
    by = -1.08,
    balanceGroup = new THREE.Group();
  balanceGroup.position.set(bx, by, 0.15);
  groups.balance.add(balanceGroup);
  layer(balanceGroup, 0.8);
  const balanceRotor = new THREE.Group();
  balanceGroup.add(balanceRotor);
  ring(0.59, 0.041, balanceRotor, gold);
  ring(0.55, 0.015, balanceRotor, brightGold);
  mesh(cylinderZ(0.035, 0.74), silver, balanceRotor, 0, 0, -0.075);
  for (let i = 0; i < 4; i++) {
    const a = (i * TAU) / 4;
    bar(
      0.07 * Math.cos(a),
      0.07 * Math.sin(a),
      0.55 * Math.cos(a),
      0.55 * Math.sin(a),
      0,
      0.055,
      gold,
      balanceRotor,
    );
  }
  for (let i = 0; i < 16; i++) {
    const a = (i * TAU) / 16;
    const w = mesh(
      new THREE.BoxGeometry(0.06, 0.046, 0.05),
      silver,
      balanceRotor,
      0.59 * Math.cos(a),
      0.59 * Math.sin(a),
      0.015,
    );
    w.rotation.z = a;
  }
  mesh(cylinderZ(0.105, 0.038), silver, balanceRotor, 0, 0, -0.085);
  mesh(cylinderZ(0.023, 0.065), ruby, balanceRotor, 0.077, 0, -0.1);
  const hairN = 400,
    hairPosition = new Float32Array((hairN + 1) * 3),
    hairGeo = new THREE.BufferGeometry();
  hairGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(hairPosition, 3).setUsage(THREE.DynamicDrawUsage),
  );
  const hairspring = new THREE.Line(
    hairGeo,
    new THREE.LineBasicMaterial({ color: 0x819bba }),
  );
  hairspring.position.z = 0.103;
  balanceGroup.add(hairspring);
  jewel(balanceGroup, 0, 0, 0.16, 0.042);
  const hairStud = mesh(
    cylinderZ(0.028, 0.065),
    silver,
    balanceGroup,
    0.39,
    0,
    0.13,
  );
  // Lever, pallet stones, banking pins. The lever dwells between impulse windows.
  const escapementGroup = new THREE.Group();
  escapementGroup.position.set(0.04, -1.12, 0.13);
  groups.escapement.add(escapementGroup);
  layer(escapementGroup, 1.2);
  const fork = new THREE.Group();
  escapementGroup.add(fork);
  mesh(
    plateShape(
      [
        [-0.76, -0.025],
        [-0.06, -0.04],
        [0.37, -0.18],
        [0.42, -0.14],
        [0.06, 0],
        [0.42, 0.15],
        [0.37, 0.19],
        [-0.06, 0.04],
        [-0.76, 0.025],
      ],
      0.035,
    ),
    blue,
    fork,
  );
  bar(-0.84, -0.06, -0.75, 0, 0.03, 0.023, silver, fork);
  bar(-0.84, 0.06, -0.75, 0, 0.03, 0.023, silver, fork);
  mesh(new THREE.BoxGeometry(0.1, 0.045, 0.07), ruby, fork, 0.39, -0.165, 0.04);
  mesh(new THREE.BoxGeometry(0.1, 0.045, 0.07), ruby, fork, 0.39, 0.17, 0.04);
  jewel(escapementGroup, 0, 0, 0.061, 0.035);
  for (const y of [-0.1, 0.1])
    mesh(cylinderZ(0.025, 0.075), silver, escapementGroup, -0.34, y, 0.017);
  // Upper bridges: curved open architectural supports with polished edges and jewels.
  const bridgeTop = new THREE.Group();
  groups.bridges.add(bridgeTop);
  bridgeTop.position.z = 0.31;
  layer(bridgeTop, 1.85);
  const bridgePolygons = [
    [
      [0.62, -0.45],
      [0.5, -0.35],
      [0.98, 0.23],
      [1.26, 0.38],
      [1.92, 0.3],
      [1.93, 0.07],
      [1.38, 0.14],
      [1.17, -0.12],
      [0.92, -0.56],
    ],
    [
      [0.13, -0.96],
      [0.1, -0.79],
      [0.57, -0.56],
      [1.55, -0.72],
      [1.62, -0.94],
      [0.53, -0.76],
    ],
    [
      [-1.91, -0.54],
      [-1.85, -0.77],
      [-1.05, -1.15],
      [-0.79, -1.11],
      [-0.81, -0.98],
      [-1.14, -0.88],
    ],
    [
      [-0.22, 1.95],
      [-0.15, 1.69],
      [0.52, 1.39],
      [1.04, 1.43],
      [1.27, 1.66],
      [1.14, 1.83],
      [0.93, 1.63],
      [0.53, 1.59],
    ],
  ];
  for (const points of bridgePolygons) {
    mesh(plateShape(points, 0.048), rhodium, bridgeTop);
    const edgePoints = points.map((p) => new THREE.Vector3(p[0], p[1], 0.065));
    edgePoints.push(edgePoints[0].clone());
    mesh(lineGeometry(edgePoints, 0.009), silver, bridgeTop);
  }
  for (const [x, y] of [
    [1.8, 0.22],
    [1.49, -0.81],
    [-1.72, -0.67],
    [1.03, 1.56],
  ])
    screw(bridgeTop, x, y, 0.094, 0.056);
  bar(0, 0, 0.61, -0.42, 0.035, 0.12, rhodium, bridgeTop);
  bar(TRAIN[4].x, TRAIN[4].y, 1.49, -0.81, 0.035, 0.13, rhodium, bridgeTop);
  for (const spec of TRAIN.slice(1))
    jewel(bridgeTop, spec.x, spec.y, 0.078, 0.044);
  jewel(bridgeTop, bx, by, 0.09, 0.05);
  textPlate('N.01', 0.45, 0.13, bridgeTop, 1.46, 0.24, 0.095, 70, '#8eaa9c');
  // Concentric motion works, exact 10:30 × 8:32 = 1:12 reduction.
  const motion = new THREE.Group();
  groups.hands.add(motion);
  motion.position.z = 0.48;
  layer(motion, 2.05);
  const cannon = mesh(
      gearGeometry(10, 0.013, 0.028, false),
      silver,
      motion,
      0,
      0,
      0.01,
    ),
    minuteWheel = mesh(
      gearGeometry(30, 0.013, 0.023, true),
      gold,
      motion,
      -0.26,
      0,
      0.01,
    ),
    minutePinion = mesh(
      gearGeometry(8, 0.013, 0.026, false),
      silver,
      motion,
      -0.26,
      0,
      0.055,
    ),
    hourWheel = mesh(
      gearGeometry(32, 0.013, 0.028, true),
      gold,
      motion,
      0,
      0,
      0.055,
    );
  mesh(annulus(0.056, 0.029, 0.24), silver, motion, 0, 0, 0.11);
  const handsGroup = new THREE.Group();
  groups.hands.add(handsGroup);
  handsGroup.position.z = 0.59;
  layer(handsGroup, 2.2);
  function hand(length: number, width: number, mat: THREE.Material, z: number) {
    const g = new THREE.Group();
    handsGroup.add(g);
    g.position.z = z;
    const pts = [
      [-width * 0.42, -0.2],
      [width * 0.42, -0.2],
      [width * 0.52, length * 0.62],
      [0, length],
      [-width * 0.52, length * 0.62],
    ];
    mesh(plateShape(pts, 0.027), mat, g);
    mesh(
      plateShape(
        [
          [-width * 0.22, 0.18],
          [width * 0.22, 0.18],
          [width * 0.24, length * 0.66],
          [0, length * 0.87],
          [-width * 0.24, length * 0.66],
        ],
        0.006,
      ),
      lume,
      g,
      0,
      0,
      0.04,
    );
    return g;
  }
  const hourHand = hand(1.18, 0.135, silver, 0),
    minuteHand = hand(1.79, 0.092, silver, 0.05);
  mesh(cylinderZ(0.033, 0.205), silver, handsGroup, 0, 0, 0.0525);
  mesh(cylinderZ(0.075, 0.025), silver, hourHand, 0, 0, 0.0125);
  mesh(cylinderZ(0.068, 0.025), silver, minuteHand, 0, 0, 0.0125);
  mesh(cylinderZ(0.1, 0.048), silver, handsGroup, 0, 0, 0.11);
  mesh(cylinderZ(0.051, 0.015), blue, handsGroup, 0, 0, 0.141);
  const fourth = TRAIN[3],
    secondsGroup = new THREE.Group();
  secondsGroup.position.set(fourth.x, fourth.y, 0.57);
  groups.hands.add(secondsGroup);
  layer(secondsGroup, 2.1);
  ring(0.405, 0.014, secondsGroup, brushed);
  const secondTicks: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 60; i++) {
    const a = (i * TAU) / 60,
      g = new THREE.BoxGeometry(0.006, i % 5 === 0 ? 0.041 : 0.018, 0.008);
    g.rotateZ(-a);
    g.translate(0.38 * Math.sin(a), 0.38 * Math.cos(a), 0.02);
    secondTicks.push(g);
  }
  batch(secondTicks, silver, secondsGroup);
  const secondsHand = new THREE.Group();
  secondsGroup.add(secondsHand);
  mesh(cylinderZ(0.023, 0.18), silver, secondsGroup, 0, 0, -0.015);
  bar(0, -0.11, 0, 0.354, 0.042, 0.026, silver, secondsHand);
  bar(0, 0.16, 0, 0.326, 0.071, 0.01, lume, secondsHand);
  mesh(cylinderZ(0.047, 0.03), silver, secondsHand, 0, 0, 0.053);
  mesh(cylinderZ(0.023, 0.008), blue, secondsHand, 0, 0, 0.073);
  // Independent pins and screws around the case-back and mainplate.
  for (let i = 0; i < 8; i++) {
    const a = (i * TAU) / 8 + 0.25;
    const x = 2.08 * Math.cos(a),
      y = 2.08 * Math.sin(a);
    screw(base, x, y, 0.091, 0.047);
    screw(caseGroup, x * 1.11, y * 1.11, -0.597, 0.049);
  }
  // Studio lighting, soft key, warm edge, cool fill and a dim mirror floor.
  const key = new THREE.SpotLight(0xfff2da, 95, 30, Math.PI / 5, 0.65, 1.6);
  key.position.set(-4, 7, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.015;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xd5ebff, 2.3);
  fill.position.set(5, 1, 5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xf4cf93, 3);
  rim.position.set(-4, -1, -2);
  scene.add(rim);
  const softbox = new THREE.RectAreaLight(0xffffff, 9, 3, 7);
  softbox.position.set(-4, 1, 5);
  softbox.lookAt(0, 0, 0);
  scene.add(softbox);
  const ambient = new THREE.AmbientLight(0xafcfbb, 0.45);
  scene.add(ambient);
  const mirror = new Reflector(new THREE.PlaneGeometry(20, 18), {
    textureWidth: 768,
    textureHeight: 768,
    color: 0xffffff,
    shader: reflectionShader,
    clipBias: 0.003,
  });
  const mirrorMaterial = mirror.material as THREE.ShaderMaterial;
  mirrorMaterial.transparent = true;
  mirrorMaterial.depthWrite = false;
  mirror.renderOrder = 1;
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.y = -3.62;
  scene.add(mirror);
  const shadow = mesh(
    new THREE.PlaneGeometry(20, 18),
    new THREE.ShadowMaterial({
      color: 0x000000,
      opacity: 0.32,
      depthWrite: false,
    }),
    scene,
    0,
    -3.6,
    0,
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.castShadow = false;
  shadow.receiveShadow = true;
  // Bake static decorations by material inside each moving assembly. Preserve the
  // parent pivots so all gear, balance and explosion coordinates remain intact.
  function mergeStaticChildren(parent: THREE.Object3D) {
    const byMaterial = new Map<string, THREE.Mesh[]>();
    for (const child of parent.children) {
      if (
        child instanceof THREE.Mesh &&
        !child.userData.ignorePick &&
        child.material instanceof THREE.MeshStandardMaterial
      ) {
        const k = child.material.uuid;
        const bucket = byMaterial.get(k) || [];
        bucket.push(child);
        byMaterial.set(k, bucket);
      }
    }
    byMaterial.forEach((list) => {
      if (list.length < 2) return;
      const geos = list.map((o) => {
        o.updateMatrix();
        const geometry = o.geometry.index
          ? o.geometry.toNonIndexed()
          : o.geometry.clone();
        return geometry.applyMatrix4(o.matrix);
      });
      const merged = mergeGeometries(geos);
      geos.forEach((g) => g.dispose());
      if (!merged) return;
      const material = list[0].material;
      list.forEach((o) => {
        parent.remove(o);
        o.geometry.dispose();
      });
      mesh(merged, material as THREE.Material, parent);
    });
  }
  [
    base,
    bridgeTop,
    caseGroup,
    bezel,
    backBezel,
    chapter,
    crown,
    balanceRotor,
    arbor,
    crownWheel,
    fork,
    hourHand,
    minuteHand,
    secondsHand,
    handsGroup,
    ...wheels,
  ].forEach(mergeStaticChildren);
  // A compatible initial tooth phase at every external gear mesh.
  const wheelPhases = [0];
  for (let i = 1; i < TRAIN.length; i++) {
    const a = TRAIN[i - 1],
      b = TRAIN[i],
      phi = Math.atan2(b.y - a.y, b.x - a.x);
    wheelPhases[i] =
      ((a.wheel + b.pinion) * phi +
        b.pinion * Math.PI -
        Math.PI -
        a.wheel * wheelPhases[i - 1]) /
      b.pinion;
  }
  // Picking tags inherit from assembly groups; sapphire is excluded to expose the mechanism.
  watch.traverse((o) => {
    if (o instanceof THREE.Mesh && !o.userData.ignorePick) pickable.push(o);
  });
  const raycaster = new THREE.Raycaster(),
    pointer = new THREE.Vector2();
  let selected: PartKey | null = null,
    hovered: PartKey | null = null;
  const highlights = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  function highlight() {
    highlights.forEach((original, o) => {
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      materials.forEach((m) => m.dispose());
      o.material = original;
    });
    highlights.clear();
    const which = hovered || selected;
    if (!which) return;
    groups[which].traverse((o) => {
      if (
        o instanceof THREE.Mesh &&
        o.material instanceof THREE.MeshStandardMaterial &&
        !o.userData.ignorePick
      ) {
        highlights.set(o, o.material);
        const mat = o.material.clone();
        mat.emissive.setHex(0x68864a);
        mat.emissiveIntensity = 0.35;
        o.material = mat;
      }
    });
  }
  function pick(e: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      (-(e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const result = raycaster.intersectObjects(pickable, false);
    if (!result.length) return null;
    let p: THREE.Object3D | null = result[0].object;
    let key: PartKey | null = null,
      windHandle = false;
    while (p) {
      key ||= (p.userData.part as PartKey) || null;
      windHandle ||= p.userData.windHandle === true;
      p = p.parent;
    }
    return key ? { key, windHandle } : null;
  }
  const hit = (e: PointerEvent) => pick(e)?.key ?? null;
  let winding = false,
    downX = 0,
    downY = 0,
    lastY = 0,
    lastX = 0,
    moved = false,
    dragPointer = -1;
  function down(e: PointerEvent) {
    transition.cancel();
    downX = lastX = e.clientX;
    downY = lastY = e.clientY;
    moved = false;
    const target = pick(e);
    if (target?.windHandle && !movement.setting) {
      winding = true;
      dragPointer = e.pointerId;
      controls.enabled = false;
      renderer.domElement.setPointerCapture(e.pointerId);
      renderer.domElement.style.cursor = 'ns-resize';
      e.stopImmediatePropagation();
      selected = 'crown';
      hooks.onSelect?.('crown');
      highlight();
    }
  }
  function move(e: PointerEvent) {
    moved ||= Math.hypot(e.clientX - downX, e.clientY - downY) > 5;
    if (winding) {
      const turns = (lastY - e.clientY) / 145;
      lastY = e.clientY;
      lastX = e.clientX;
      if (turns > 0) {
        movement.wind(turns);
        hooks.onWind?.(movement.reserve >= 172800);
      }
      return;
    }
    if (e.buttons) return;
    const target = pick(e),
      part = target?.key ?? null;
    if (part !== hovered) {
      hovered = part;
      highlight();
    }
    renderer.domElement.style.cursor = target?.windHandle
      ? 'ns-resize'
      : part
        ? 'pointer'
        : 'grab';
    const rect = container.getBoundingClientRect();
    hooks.onHover?.(
      part
        ? { key: part, x: e.clientX - rect.left, y: e.clientY - rect.top }
        : null,
    );
  }
  function up(e: PointerEvent) {
    if (winding) {
      winding = false;
      controls.enabled = true;
      if (renderer.domElement.hasPointerCapture(e.pointerId))
        renderer.domElement.releasePointerCapture(e.pointerId);
      dragPointer = -1;
      return;
    }
    if (!moved) {
      selected = hit(e);
      hooks.onSelect?.(selected);
      highlight();
    }
  }
  function leave() {
    hovered = null;
    hooks.onHover?.(null);
    highlight();
  }
  function cancel() {
    winding = false;
    controls.enabled = true;
    if (dragPointer >= 0 && renderer.domElement.hasPointerCapture(dragPointer))
      renderer.domElement.releasePointerCapture(dragPointer);
    dragPointer = -1;
  }
  function keyboard(e: KeyboardEvent) {
    if (e.key.startsWith('Arrow') || ['+', '=', '-'].includes(e.key))
      transition.cancel();
    if (e.key === 'w' || e.key === 'W') {
      movement.wind(0.25);
      hooks.onWind?.(movement.reserve >= 172800);
    } else if (e.key === '+' || e.key === '=') zoom(0.92);
    else if (e.key === '-') zoom(1.08);
    else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const axis =
        e.key === 'ArrowUp' || e.key === 'ArrowDown'
          ? new THREE.Vector3(1, 0, 0)
          : new THREE.Vector3(0, 1, 0);
      camera.position
        .sub(controls.target)
        .applyAxisAngle(
          axis,
          e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? 0.08 : -0.08,
        )
        .add(controls.target);
    }
    controls.update();
  }
  renderer.domElement.addEventListener('pointerdown', down, true);
  renderer.domElement.addEventListener('pointermove', move);
  renderer.domElement.addEventListener('pointerup', up);
  renderer.domElement.addEventListener('pointercancel', cancel);
  renderer.domElement.addEventListener('pointerleave', leave);
  renderer.domElement.addEventListener('keydown', keyboard);
  function contextLost(e: Event) {
    e.preventDefault();
    hooks.onError?.('3D 显示连接已中断，请刷新页面恢复。');
  }
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  let frame = 0,
    ex = 0,
    exTarget = 0,
    night = 0,
    nightTarget = 0,
    last = performance.now(),
    lastUi = 0,
    lastSpringReserve = -1,
    lastSpringAngle = -1;
  let auto = false,
    framed = false;
  const resize = () => {
    const r = container.getBoundingClientRect();
    if (!r.width || !r.height) return;
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    renderer.setSize(r.width, r.height);
    if (!framed) {
      const pose = viewPose(camera.aspect);
      camera.position.copy(pose.position);
      controls.target.copy(pose.target);
      framed = true;
    }
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  function springUpdate() {
    const barrelAngle = movement.angle(28800, 1),
      arborAngle = (movement.crownTurns / 4) * TAU,
      charge = movement.reserve / 172800;
    if (
      Math.abs(movement.reserve - lastSpringReserve) < 0.04 &&
      Math.abs(barrelAngle - lastSpringAngle) < 0.000001
    )
      return;
    lastSpringReserve = movement.reserve;
    lastSpringAngle = barrelAngle;
    for (let i = 0; i <= springCount; i++) {
      const t = i / springCount,
        r = 0.093 + (barrelR * 0.85 - 0.093) * Math.pow(t, 1 + charge * 0.85),
        a = -TAU * 9 * t + arborAngle * (1 - t) + barrelAngle * t;
      for (let j = 0; j < 2; j++) {
        const rr = r + (j ? 1 : -1) * 0.007,
          k = i * 6 + j * 3;
        springVertices[k] = rr * Math.cos(a);
        springVertices[k + 1] = rr * Math.sin(a);
        springVertices[k + 2] = 0;
      }
    }
    springGeo.attributes.position.needsUpdate = true;
    springGeo.computeVertexNormals();
    springGeo.computeBoundingSphere();
  }
  function animate(now: number) {
    frame = requestAnimationFrame(animate);
    const dt = Math.max(0, (now - last) / 1000);
    last = now;
    movement.advance(dt);
    const ease = 1 - Math.exp(-Math.min(dt, 0.1) * 6);
    ex += (exTarget - ex) * ease;
    night += (nightTarget - night) * ease;
    explodeNodes.forEach(
      ({ node, base, factor }) =>
        (node.position.z = base + factor * ex * EXPLOSION_SPACING),
    );
    TRAIN.forEach(
      (spec, i) =>
        (wheels[i].rotation.z =
          wheelPhases[i] + movement.angle(spec.period, spec.direction)),
    );
    balanceRotor.rotation.z = movement.balanceAngle;
    fork.rotation.z = movement.forkAngle;
    arbor.rotation.z = (movement.crownTurns / 4) * TAU;
    crownWheel.rotation.z = (-movement.crownTurns / 3) * TAU;
    crown.rotation.x = -movement.crownTurns * TAU;
    bevelPinion.rotation.x = -movement.crownTurns * TAU;
    click.rotation.z = Math.sin(movement.crownTurns * TAU * 12) * 0.06;
    stem.position.x = 0.95 + (movement.setting ? 0.16 : 0);
    const seconds = movement.seconds;
    hourHand.rotation.z = (-seconds / 43200) * TAU;
    minuteHand.rotation.z = (-seconds / 3600) * TAU;
    secondsHand.rotation.z = (-seconds / 60) * TAU;
    cannon.rotation.z = minuteHand.rotation.z;
    minuteWheel.rotation.z = (seconds / 10800) * TAU;
    minutePinion.rotation.z = minuteWheel.rotation.z;
    hourWheel.rotation.z = hourHand.rotation.z;
    for (let i = 0; i <= hairN; i++) {
      const t = i / hairN,
        a = -t * TAU * 8 + movement.balanceAngle * (1 - t),
        r = 0.055 + 0.335 * t,
        k = i * 3;
      hairPosition[k] = r * Math.cos(a);
      hairPosition[k + 1] = r * Math.sin(a);
      hairPosition[k + 2] = 0;
    }
    hairGeo.attributes.position.needsUpdate = true;
    hairGeo.computeBoundingSphere();
    springUpdate();
    key.intensity = 95 * (1 - night * 0.96);
    fill.intensity = 2.3 * (1 - night * 0.96);
    rim.intensity = 3 * (1 - night * 0.95);
    softbox.intensity = 9 * (1 - night * 0.96);
    ambient.intensity = 0.45 * (1 - night * 0.94);
    scene.environmentIntensity = 1.1 * (1 - night * 0.965);
    lume.emissiveIntensity = 0.25 + night * 4.8;
    renderer.toneMappingExposure = 1.15 + night * 0.1;
    transition.update(Math.min(dt, 0.1));
    controls.autoRotate = auto && !winding && !transition.active;
    controls.update();
    renderer.render(scene, camera);
    if (now - lastUi > 110) {
      hooks.onSnapshot?.(movement.snapshot());
      lastUi = now;
    }
  }
  frame = requestAnimationFrame(animate);
  function zoom(f: number) {
    transition.cancel();
    const offset = camera.position.clone().sub(controls.target);
    const d = THREE.MathUtils.clamp(offset.length() * f, 6.3, 90);
    camera.position.copy(offset.setLength(d)).add(controls.target);
  }
  return {
    movement,
    explode(v: boolean) {
      auto = false;
      exTarget = v ? 1 : 0;
      const pose = viewPose(camera.aspect, v);
      transition.start(pose.position, pose.target);
    },
    explodeAmount(v: number) {
      exTarget = THREE.MathUtils.clamp(v, 0, 1);
    },
    night(v: boolean) {
      nightTarget = v ? 1 : 0;
    },
    auto(v: boolean) {
      auto = v;
    },
    select(part: PartKey | null) {
      selected = part;
      hovered = null;
      highlight();
      hooks.onSelect?.(part);
    },
    wind(turns: number) {
      const accepted = movement.wind(turns);
      hooks.onWind?.(movement.reserve >= 172800);
      hooks.onSnapshot?.(movement.snapshot());
      return accepted;
    },
    setting(v: boolean) {
      movement.setting = v;
      hooks.onSnapshot?.(movement.snapshot());
    },
    speed(v: number) {
      if (Number.isFinite(v) && v > 0) movement.speed = v;
    },
    zoom,
    back() {
      const pose = viewPose(camera.aspect, false, true);
      transition.start(pose.position, pose.target);
    },
    reset() {
      const pose = viewPose(camera.aspect);
      transition.start(pose.position, pose.target);
      auto = false;
    },
    dispose() {
      cancelAnimationFrame(frame);
      cancel();
      observer.disconnect();
      controls.removeEventListener('start', cancelViewTransition);
      transition.cancel();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', down, true);
      renderer.domElement.removeEventListener('pointermove', move);
      renderer.domElement.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('pointercancel', cancel);
      renderer.domElement.removeEventListener('pointerleave', leave);
      renderer.domElement.removeEventListener('keydown', keyboard);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      highlights.forEach((original, o) => {
        (o.material as THREE.Material).dispose();
        o.material = original;
      });
      const geos = new Set<THREE.BufferGeometry>(),
        mats = new Set<THREE.Material>(),
        textures = new Set<THREE.Texture>();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
          geos.add(o.geometry);
          const a = Array.isArray(o.material) ? o.material : [o.material];
          a.forEach((m) => {
            mats.add(m);
            Object.values(m).forEach((v) => {
              if (v instanceof THREE.Texture) textures.add(v);
            });
          });
        }
      });
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      mirror.getRenderTarget().dispose();
      envTarget.dispose();
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
