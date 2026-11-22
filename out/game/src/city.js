// Coral Bay city: a procedural sun-soaked coastal city.
// One seeded random stream lays out every block, so the city is identical on every load.
// Layout: an 8x8 grid of blocks separated by roads, a sand beach along the south edge
// and a marina with docks and boats along the east edge. Buildings are coloured boxes
// with a shared canvas window texture; palms and lamps line the sidewalks.
import * as THREE from 'three';

export const BLOCK = 44;
export const ROAD = 14;
export const GRID = 8;
export const HALF = (GRID * BLOCK + (GRID + 1) * ROAD) / 2; // 239

// Deterministic random stream (mulberry32) so screenshots and saves agree.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function roadCenter(i) {
  return -HALF + ROAD / 2 + i * (BLOCK + ROAD);
}

export function blockCenter(i) {
  return roadCenter(i) + ROAD / 2 + BLOCK / 2;
}

const PALETTE = [
  0xff9e7d, 0xffd166, 0x8ecae6, 0x90be6d, 0xf28482,
  0x84a59d, 0xf6bd60, 0xe07a5f, 0x81b29a, 0xf2cc8f,
  0xef476f, 0x06d6a0, 0x118ab2, 0xffb703,
];

function windowTexture(rand, tint) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = tint;
  g.fillRect(0, 0, 128, 256);
  for (let y = 10; y < 246; y += 22) {
    for (let x = 10; x < 118; x += 22) {
      const lit = rand() < 0.42;
      g.fillStyle = lit ? '#ffe9a8' : '#20262e';
      g.fillRect(x, y, 14, 16);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, seed = 20261122) {
  const rand = mulberry32(seed);
  const colliders = [];   // {minX,maxX,minZ,maxZ} building footprints
  const circles = [];     // {x,z,r} palm trunks (soft collision)
  const group = new THREE.Group();
  group.name = 'city';

  // --- ground: asphalt under everything, then lighter sidewalk slabs per block
  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF * 2 + 260, HALF * 2 + 260),
    new THREE.MeshLambertMaterial({ color: 0x3a3f44 }),
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set(20, 0, 20);
  asphalt.receiveShadow = true;
  group.add(asphalt);

  const slabMat = new THREE.MeshLambertMaterial({ color: 0xb8b0a4 });
  const slabGeo = new THREE.BoxGeometry(BLOCK, 0.4, BLOCK);
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const slab = new THREE.Mesh(slabGeo, slabMat);
      slab.position.set(blockCenter(i), 0.2, blockCenter(j));
      slab.receiveShadow = true;
      group.add(slab);
    }
  }

  // --- beach (south) and water, marina (east) and water
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF * 2 + 260, 70),
    new THREE.MeshLambertMaterial({ color: 0xe8d8a0 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(20, 0.05, HALF + 35);
  sand.receiveShadow = true;
  group.add(sand);

  const waterMat = new THREE.MeshLambertMaterial({ color: 0x2a9d8f, transparent: true, opacity: 0.88 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 260, 220), waterMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(20, 0.02, HALF + 70 + 110);
  group.add(sea);
  const marinaWater = new THREE.Mesh(new THREE.PlaneGeometry(120, HALF * 2 + 60), waterMat);
  marinaWater.rotation.x = -Math.PI / 2;
  marinaWater.position.set(HALF + 60, 0.02, 0);
  group.add(marinaWater);

  // --- buildings, one to three per block, taller near downtown
  const texA = windowTexture(rand, '#f4ede0');
  const texB = windowTexture(rand, '#dfe9ee');
  const texC = windowTexture(rand, '#e8dcc8');
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x5a5f66 });
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const cx = blockCenter(i);
      const cz = blockCenter(j);
      const distDowntown = Math.hypot(cx, cz) / HALF;
      const count = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < count; k++) {
        const w = 12 + rand() * 14;
        const d = 12 + rand() * 14;
        const h = 9 + rand() * (30 - distDowntown * 14) + (distDowntown < 0.35 ? 14 : 0);
        const ox = (rand() - 0.5) * (BLOCK - w - 6);
        const oz = (rand() - 0.5) * (BLOCK - d - 6);
        const x = cx + ox;
        const z = cz + oz;
        // Keep the landmark plots clear (handled by caller via reserve list).
        const mat = new THREE.MeshLambertMaterial({
          color: PALETTE[Math.floor(rand() * PALETTE.length)],
          map: [texA, texB, texC][Math.floor(rand() * 3)],
        });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        b.position.set(x, h / 2 + 0.4, z);
        b.castShadow = true;
        b.receiveShadow = true;
        group.add(b);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6), roofMat);
        roof.position.set(x, h + 0.8, z);
        group.add(roof);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }

  // --- palms along sidewalk corners
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6b46 });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2f9e44 });
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 7, 6);
  const frondGeo = new THREE.ConeGeometry(1.1, 4.4, 5);
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      if (rand() < 0.35) continue;
      const px = blockCenter(i) + (rand() < 0.5 ? -1 : 1) * (BLOCK / 2 - 2);
      const pz = blockCenter(j) + (rand() < 0.5 ? -1 : 1) * (BLOCK / 2 - 2);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(px, 3.5 + 0.4, pz);
      trunk.castShadow = true;
      group.add(trunk);
      for (let f = 0; f < 5; f++) {
        const frond = new THREE.Mesh(frondGeo, frondMat);
        const a = (f / 5) * Math.PI * 2;
        frond.position.set(px + Math.cos(a) * 1.4, 7.6, pz + Math.sin(a) * 1.4);
        frond.rotation.set(Math.sin(a) * 1.1, 0, Math.cos(a) * 1.1 + Math.PI);
        group.add(frond);
      }
      circles.push({ x: px, z: pz, r: 0.7 });
    }
  }

  // --- street lamps along the roads
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2b2f33 });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffdf80, emissiveIntensity: 0.9 });
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6.5, 6);
  const lampGeo = new THREE.SphereGeometry(0.55, 8, 6);
  for (let i = 0; i <= GRID; i++) {
    for (let j = 0; j <= GRID; j += 2) {
      const lx = roadCenter(i) + ROAD / 2 - 0.6;
      const lz = roadCenter(j) + ROAD / 2 - 0.6;
      if (Math.abs(lx) > HALF || Math.abs(lz) > HALF) continue;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(lx, 3.25, lz);
      group.add(pole);
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(lx, 6.6, lz);
      group.add(lamp);
    }
  }

  // --- marina docks and boats (east edge)
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x9c7a4d });
  for (let d = 0; d < 3; d++) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(34, 0.8, 5), woodMat);
    dock.position.set(HALF + 18, 0.4, -140 + d * 140);
    dock.receiveShadow = true;
    group.add(dock);
  }
  const hullColors = [0xe63946, 0xf4f1de, 0x457b9d, 0x2a9d8f];
  for (let b = 0; b < 4; b++) {
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(10, 2.2, 4),
      new THREE.MeshLambertMaterial({ color: hullColors[b] }),
    );
    hull.position.set(HALF + 34, 1.1, -170 + b * 110);
    hull.castShadow = true;
    group.add(hull);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 2, 3),
      new THREE.MeshLambertMaterial({ color: 0xf4f1de }),
    );
    cabin.position.set(HALF + 33, 3, -170 + b * 110);
    group.add(cabin);
  }

  // --- landmarks: fixed spots the missions use
  const landmarks = {
    jewelry: { x: blockCenter(6), z: blockCenter(1) + 11 }, // shop door, south face
    downtown: { x: -5, z: blockCenter(4) },             // drop-off at the roadside
    marina: { x: HALF + 18, z: 0 },                       // package pickup on the docks
    beach: { x: 0, z: HALF + 40 },                         // escape point on the sand
    playerSpawn: { x: roadCenter(4), z: 116 },
  };
  // A gold-fronted jewellery store on its block so players can find it.
  const shop = new THREE.Mesh(
    new THREE.BoxGeometry(20, 12, 16),
    new THREE.MeshLambertMaterial({ color: 0xd4a017, map: texA }),
  );
  shop.position.set(blockCenter(6), 6.4, blockCenter(1));
  shop.castShadow = true;
  group.add(shop);
  colliders.push({
    minX: blockCenter(6) - 10, maxX: blockCenter(6) + 10,
    minZ: blockCenter(1) - 8, maxZ: blockCenter(1) + 8,
  });

  scene.add(group);
  return { colliders, circles, landmarks, group };
}

// Push a circle (x, z, radius) out of every building AABB it overlaps.
// Returns true when a push happened.
export function resolveBuildingCollision(city, x, z, r) {
  let hit = false;
  for (const b of city.colliders) {
    const cx = Math.max(b.minX, Math.min(x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        return { x: x + dx * push, z: z + dz * push, hit: true };
      }
      // Dead centre: push out along the smallest penetration axis.
      const left = x - b.minX, right = b.maxX - x;
      const top = z - b.minZ, bottom = b.maxZ - z;
      const m = Math.min(left, right, top, bottom);
      if (m === left) return { x: b.minX - r, z, hit: true };
      if (m === right) return { x: b.maxX + r, z, hit: true };
      if (m === top) return { x, z: b.minZ - r, hit: true };
      return { x, z: b.maxZ + r, hit: true };
    }
  }
  return { x, z, hit };
}

export function insideCity(x, z, margin = 6) {
  return Math.abs(x) < HALF + margin && z > -HALF - margin && z < HALF + 110;
}
