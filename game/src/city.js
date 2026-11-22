// CORAL BAY — the city itself.
// A procedural coastal city on a seeded stream, so every load builds the same
// streets. Eight by eight blocks on a road grid, a sand beach along the south
// shore and a marina with docks and boats on the east side. Buildings are
// coloured boxes with a shared lit-window texture; palms and lamps line the
// sidewalks. The missions read their fixed spots from `landmarks`.
import * as THREE from 'three';

export const BLOCK = 44;
export const ROAD = 14;
export const GRID = 8;
export const HALF = (GRID * BLOCK + (GRID + 1) * ROAD) / 2; // 239

// Small deterministic PRNG (mulberry32). One seed, one city, every time.
export function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let v = Math.imul(s ^ (s >>> 15), 1 | s);
    v = (v + Math.imul(v ^ (v >>> 7), 61 | v)) ^ v;
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
}

export const roadCenter = (i) => -HALF + ROAD / 2 + i * (BLOCK + ROAD);
export const blockCenter = (i) => roadCenter(i) + ROAD / 2 + BLOCK / 2;

const PAINT = [
  0xff9e7d, 0xffd166, 0x8ecae6, 0x90be6d, 0xf28482, 0x84a59d,
  0xf6bd60, 0xe07a5f, 0x81b29a, 0xf2cc8f, 0xef476f, 0x06d6a0,
  0x118ab2, 0xffb703,
];

// A facade texture: tinted wall with a grid of windows, some lit.
function facadeTexture(rand, tint) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = tint;
  g.fillRect(0, 0, 128, 256);
  for (let y = 12; y < 244; y += 22) {
    for (let x = 12; x < 116; x += 22) {
      g.fillStyle = rand() < 0.4 ? '#ffe9a8' : '#222a33';
      g.fillRect(x, y, 14, 15);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, seed = 20261123) {
  const rand = mulberry32(seed);
  const walls = [];   // building footprints {minX,maxX,minZ,maxZ}
  const trunks = [];  // palm trunks {x,z,r} for soft collision
  const city = new THREE.Group();
  city.name = 'coral-bay';

  const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

  // Ground: one big asphalt sheet, then a pale slab on every block.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF * 2 + 260, HALF * 2 + 260),
    lambert(0x3a3f44),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(20, 0, 20);
  ground.receiveShadow = true;
  city.add(ground);

  const slabGeo = new THREE.BoxGeometry(BLOCK, 0.4, BLOCK);
  const slabMat = lambert(0xb8b0a4);
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const slab = new THREE.Mesh(slabGeo, slabMat);
      slab.position.set(blockCenter(i), 0.2, blockCenter(j));
      slab.receiveShadow = true;
      city.add(slab);
    }
  }

  // Beach to the south, open sea beyond it, marina water to the east.
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 260, 70), lambert(0xe8d8a0));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(20, 0.05, HALF + 35);
  sand.receiveShadow = true;
  city.add(sand);

  const seaMat = lambert(0x2a9d8f, { transparent: true, opacity: 0.88 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 260, 220), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(20, 0.02, HALF + 180);
  city.add(sea);
  const harbour = new THREE.Mesh(new THREE.PlaneGeometry(120, HALF * 2 + 60), seaMat);
  harbour.rotation.x = -Math.PI / 2;
  harbour.position.set(HALF + 60, 0.02, 0);
  city.add(harbour);

  // Buildings: one to three per block, taller toward the middle.
  const faces = [facadeTexture(rand, '#f4ede0'), facadeTexture(rand, '#dfe9ee'), facadeTexture(rand, '#e8dcc8')];
  const roofMat = lambert(0x5a5f66);
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const cx = blockCenter(i);
      const cz = blockCenter(j);
      const downtown = Math.hypot(cx, cz) / HALF;
      const n = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < n; k++) {
        const w = 12 + rand() * 14;
        const d = 12 + rand() * 14;
        const h = 9 + rand() * (30 - downtown * 14) + (downtown < 0.35 ? 14 : 0);
        const x = cx + (rand() - 0.5) * (BLOCK - w - 6);
        const z = cz + (rand() - 0.5) * (BLOCK - d - 6);
        const tower = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, d),
          new THREE.MeshLambertMaterial({
            color: PAINT[Math.floor(rand() * PAINT.length)],
            map: faces[Math.floor(rand() * faces.length)],
          }),
        );
        tower.position.set(x, h / 2 + 0.4, z);
        tower.castShadow = true;
        tower.receiveShadow = true;
        city.add(tower);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6), roofMat);
        roof.position.set(x, h + 0.8, z);
        city.add(roof);
        walls.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }

  // Palms on block corners, with a frond star on top of each trunk.
  const trunkMat = lambert(0x8a6b46);
  const frondMat = lambert(0x2f9e44);
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 7, 6);
  const frondGeo = new THREE.ConeGeometry(1.1, 4.4, 5);
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      if (rand() < 0.35) continue;
      const px = blockCenter(i) + (rand() < 0.5 ? -1 : 1) * (BLOCK / 2 - 2);
      const pz = blockCenter(j) + (rand() < 0.5 ? -1 : 1) * (BLOCK / 2 - 2);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(px, 3.9, pz);
      trunk.castShadow = true;
      city.add(trunk);
      for (let f = 0; f < 5; f++) {
        const a = (f / 5) * Math.PI * 2;
        const frond = new THREE.Mesh(frondGeo, frondMat);
        frond.position.set(px + Math.cos(a) * 1.4, 7.6, pz + Math.sin(a) * 1.4);
        frond.rotation.set(Math.sin(a) * 1.1, 0, Math.cos(a) * 1.1 + Math.PI);
        city.add(frond);
      }
      trunks.push({ x: px, z: pz, r: 0.7 });
    }
  }

  // Street lamps along the roads, every other crossing.
  const poleMat = lambert(0x2b2f33);
  const bulbMat = lambert(0xfff2b0, { emissive: 0xffdf80, emissiveIntensity: 0.9 });
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6.5, 6);
  const bulbGeo = new THREE.SphereGeometry(0.55, 8, 6);
  for (let i = 0; i <= GRID; i++) {
    for (let j = 0; j <= GRID; j += 2) {
      const lx = roadCenter(i) + ROAD / 2 - 0.6;
      const lz = roadCenter(j) + ROAD / 2 - 0.6;
      if (Math.abs(lx) > HALF || Math.abs(lz) > HALF) continue;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(lx, 3.25, lz);
      city.add(pole);
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(lx, 6.6, lz);
      city.add(bulb);
    }
  }

  // Marina: three wooden docks and four moored boats.
  const woodMat = lambert(0x9c7a4d);
  for (let d = 0; d < 3; d++) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(34, 0.8, 5), woodMat);
    dock.position.set(HALF + 18, 0.4, -140 + d * 140);
    dock.receiveShadow = true;
    city.add(dock);
  }
  const hullPaint = [0xe63946, 0xf4f1de, 0x457b9d, 0x2a9d8f];
  for (let b = 0; b < 4; b++) {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(10, 2.2, 4), lambert(hullPaint[b]));
    hull.position.set(HALF + 34, 1.1, -170 + b * 110);
    hull.castShadow = true;
    city.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2, 3), lambert(0xf4f1de));
    cabin.position.set(HALF + 33, 3, -170 + b * 110);
    city.add(cabin);
  }

  // Fixed spots the story uses.
  const landmarks = {
    jewelry: { x: blockCenter(6), z: blockCenter(1) + 11 },
    downtown: { x: -5, z: blockCenter(4) },
    marina: { x: HALF + 18, z: 0 },
    beach: { x: 0, z: HALF + 40 },
    playerSpawn: { x: roadCenter(4), z: 116 },
  };
  // The jewellery store itself: a gold-fronted shop on its block.
  const shop = new THREE.Mesh(
    new THREE.BoxGeometry(20, 12, 16),
    new THREE.MeshLambertMaterial({ color: 0xd4a017, map: faces[0] }),
  );
  shop.position.set(blockCenter(6), 6.4, blockCenter(1));
  shop.castShadow = true;
  city.add(shop);
  walls.push({
    minX: blockCenter(6) - 10, maxX: blockCenter(6) + 10,
    minZ: blockCenter(1) - 8, maxZ: blockCenter(1) + 8,
  });

  scene.add(city);
  return { colliders: walls, circles: trunks, landmarks, group: city };
}

// Push a circle of radius r at (x, z) out of any building it overlaps.
export function resolveBuildingCollision(city, x, z, r) {
  for (const b of city.colliders) {
    const cx = Math.max(b.minX, Math.min(x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      const push = (r - d) / d;
      return { x: x + dx * push, z: z + dz * push, hit: true };
    }
    // Dead centre: escape along the shallowest side.
    const sides = [
      { x: b.minX - r, z, depth: x - b.minX },
      { x: b.maxX + r, z, depth: b.maxX - x },
      { x, z: b.minZ - r, depth: z - b.minZ },
      { x, z: b.maxZ + r, depth: b.maxZ - z },
    ];
    sides.sort((a, b) => a.depth - b.depth);
    return { x: sides[0].x, z: sides[0].z, hit: true };
  }
  return { x, z, hit: false };
}

export function insideCity(x, z, margin = 6) {
  return Math.abs(x) < HALF + margin && z > -HALF - margin && z < HALF + 110;
}
