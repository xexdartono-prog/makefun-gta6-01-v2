// Coral Bay's city: the road grid, the blocks, the beach and the harbor.
// Everything here is procedural — no model files, just boxes, planes and a
// window texture painted on a canvas at runtime.

import * as THREE from 'three';

// A small seeded generator so the city is the same on every load.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const LAYOUT = {
  pitch: 52,            // distance between neighbouring road centrelines
  roadHalf: 6,          // half the width of a road
  min: -208, max: 208,  // the built city's edge
  beachZ: 196,          // sand starts here (south edge)
  seaZ: 224,            // the waterline
  harborX: 196,         // container yard starts here (east edge)
};

// The eight road centrelines on each axis.
export const ROADS = [];
for (let i = 0; i < 8; i++) ROADS.push(-182 + i * 52);

const PALETTE = [0xd8a06a, 0xc97b5e, 0x8fa3b8, 0xe0cfa8, 0x9db8a0, 0xb0708a, 0x7fa8c9, 0xd9b380, 0xa8b0b8, 0xe8b4a0];
const PARK_CHANCE = 0.16;

function windowTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = '#2c3e50';
  for (let y = 14; y < 246; y += 30) {
    for (let x = 10; x < 118; x += 26) {
      g.fillRect(x, y, 16, 20);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createCity(world) {
  const { scene } = world;
  const rand = mulberry32(20261123);
  const winTex = windowTexture();
  const colliders = world.colliders;

  // Sky, fog and light.
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x9fd4ef, 260, 620);
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 600;
  scene.add(sun);

  // Ground: asphalt for the whole city, then slabs, sand and sea on top.
  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshLambertMaterial({ color: 0x3d434a }),
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set(0, 0, 0);
  asphalt.receiveShadow = true;
  scene.add(asphalt);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 60),
    new THREE.MeshLambertMaterial({ color: 0xe8d29a }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, 226);
  sand.receiveShadow = true;
  scene.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 260),
    new THREE.MeshLambertMaterial({ color: 0x1e7fa8 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, 380);
  scene.add(sea);

  // Road centre dashes, one thin strip per road, both directions.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
  for (const r of ROADS) {
    for (let d = -195; d < 195; d += 26) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 9), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(r, 0.03, d + 4);
      scene.add(dash);
      const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.2), dashMat);
      dash2.rotation.x = -Math.PI / 2;
      dash2.position.set(d + 4, 0.03, r);
      scene.add(dash2);
    }
  }

  const blockCentres = [];
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 7; j++) {
      blockCentres.push({ x: ROADS[i] + 26, z: ROADS[j] + 26 });
    }
  }

  const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofGeo = new THREE.BoxGeometry(1, 1, 1);
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 5, 6);
  const crownGeo = new THREE.IcosahedronGeometry(2.4, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x2f8f4e });
  const slabMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a3 });
  const parkMat = new THREE.MeshLambertMaterial({ color: 0x5da864 });

  const palms = [];
  function addPalm(x, z) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 2.5, z);
    trunk.castShadow = true;
    scene.add(trunk);
    const crown = new THREE.Mesh(crownGeo, crownMat);
    crown.scale.y = 0.55;
    crown.position.set(x, 5.6, z);
    crown.castShadow = true;
    scene.add(crown);
    palms.push({ x, z });
    colliders.push({ minX: x - 0.6, maxX: x + 0.6, minZ: z - 0.6, maxZ: z + 0.6 });
  }

  const parkingSpots = [];
  for (const b of blockCentres) {
    // A concrete slab for the whole block, then either a park or buildings.
    const slab = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), rand() < PARK_CHANCE ? parkMat : slabMat);
    slab.rotation.x = -Math.PI / 2;
    slab.position.set(b.x, 0.02, b.z);
    slab.receiveShadow = true;
    scene.add(slab);

    if (rand() < PARK_CHANCE) {
      for (let t = 0; t < 4; t++) addPalm(b.x - 12 + rand() * 24, b.z - 12 + rand() * 24);
      continue;
    }
    const count = 1 + Math.floor(rand() * 3);
    for (let k = 0; k < count; k++) {
      const w = 10 + rand() * 10;
      const d = 10 + rand() * 10;
      const h = 8 + rand() * rand() * 36;
      const x = b.x - 14 + (k % 2) * 16 + rand() * 4;
      const z = b.z - 12 + Math.floor(k / 2) * 18 + rand() * 4;
      const mat = new THREE.MeshLambertMaterial({ color: PALETTE[Math.floor(rand() * PALETTE.length)] });
      mat.map = winTex;
      const building = new THREE.Mesh(buildingGeo, mat);
      building.scale.set(w, h, d);
      building.position.set(x, h / 2, z);
      building.castShadow = true;
      building.receiveShadow = true;
      scene.add(building);
      const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: 0x4a4a52 }));
      roof.scale.set(w + 0.6, 0.8, d + 0.6);
      roof.position.set(x, h + 0.4, z);
      scene.add(roof);
      colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    }
    // Palms along the block's south edge.
    if (rand() < 0.6) addPalm(b.x - 16, b.z + 17);
    if (rand() < 0.6) addPalm(b.x + 16, b.z + 17);
  }

  // A few parked-car spots along road edges (the car module fills them).
  const spotRand = mulberry32(777);
  for (let i = 0; i < 14; i++) {
    const road = ROADS[Math.floor(spotRand() * ROADS.length)];
    const along = -180 + spotRand() * 360;
    const side = spotRand() < 0.5 ? -1 : 1;
    const horizontal = spotRand() < 0.5;
    parkingSpots.push({
      x: horizontal ? along : road + side * 8.5,
      z: horizontal ? road + side * 8.5 : along,
      heading: horizontal ? 0 : Math.PI / 2,
    });
  }

  // The harbor: a concrete yard, stacked containers, two cranes, a pier.
  const yard = new THREE.Mesh(
    new THREE.PlaneGeometry(56, 400),
    new THREE.MeshLambertMaterial({ color: 0x8a8f94 }),
  );
  yard.rotation.x = -Math.PI / 2;
  yard.position.set(222, 0.02, 0);
  yard.receiveShadow = true;
  scene.add(yard);

  const containerCols = [0xd84a3a, 0x3a7bd8, 0x3ad86a, 0xe8a13a, 0x8a5ad8];
  const yardRand = mulberry32(4242);
  for (let i = 0; i < 16; i++) {
    const w = 12, h = 2.6 + yardRand() * 2.6, d = 2.6;
    const x = 206 + yardRand() * 36;
    const z = -180 + yardRand() * 360;
    const c = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color: containerCols[i % containerCols.length] }),
    );
    c.position.set(x, h / 2, z);
    c.castShadow = true;
    c.receiveShadow = true;
    scene.add(c);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }
  // Two gantry cranes over the yard.
  for (const cz of [-90, 70]) {
    const legMat = new THREE.MeshLambertMaterial({ color: 0xe8b13a });
    for (const dx of [-8, 8]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(2, 26, 2), legMat);
      leg.position.set(224 + dx, 13, cz);
      leg.castShadow = true;
      scene.add(leg);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(22, 2, 3), legMat);
    beam.position.set(224, 27, cz);
    beam.castShadow = true;
    scene.add(beam);
  }
  // The pier reaching into the sea at the south-east corner.
  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(10, 1, 60),
    new THREE.MeshLambertMaterial({ color: 0x7a6a52 }),
  );
  pier.position.set(196, 0.4, 226);
  pier.receiveShadow = true;
  scene.add(pier);

  return { parkingSpots, palms, playerSpawn: { x: -156, z: -156, heading: Math.PI * 0.75 } };
}
