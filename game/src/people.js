// Pedestrians: the people of Coral Bay, strolling the sidewalks, wandering
// between blocks, and running away when a car comes at them too fast.

import * as THREE from 'three';
import { ROADS } from './city.js';

const SHIRTS = [0xe8e8e8, 0x4a90d8, 0xd84a7a, 0x4ad88a, 0xe8a13a, 0x8a5ad8, 0x3a3a3a, 0xd8d84a];
const PANTS = [0x2e4a6b, 0x3a3a3a, 0x6b4a2e, 0x4a6b3a];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildPed(shirt, pants) {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.85, 0.4),
    new THREE.MeshLambertMaterial({ color: shirt }),
  );
  torso.position.y = 1.1;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.44, 0.44),
    new THREE.MeshLambertMaterial({ color: 0xd8a878 }),
  );
  head.position.y = 1.8;
  g.add(head);
  const legGeo = new THREE.BoxGeometry(0.28, 0.7, 0.32);
  const legMat = new THREE.MeshLambertMaterial({ color: pants });
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-0.18, 0.35, 0);
  g.add(legL);
  const legR = new THREE.Mesh(legGeo, legMat);
  legR.position.set(0.18, 0.35, 0);
  g.add(legR);
  g.userData = { legL, legR };
  return g;
}

export function createPeds(world) {
  const rand = mulberry32(31337);
  for (let i = 0; i < 16; i++) {
    const road = ROADS[Math.floor(rand() * ROADS.length)];
    const horizontal = rand() < 0.5;
    const along = -190 + rand() * 380;
    const side = rand() < 0.5 ? -9.5 : 9.5;
    const ped = {
      mesh: buildPed(SHIRTS[Math.floor(rand() * SHIRTS.length)], PANTS[Math.floor(rand() * PANTS.length)]),
      pos: new THREE.Vector3(
        horizontal ? along : road + side,
        0,
        horizontal ? road + side : along,
      ),
      heading: rand() * Math.PI * 2,
      speed: 1.2 + rand() * 1.1,
      target: null,
      fleeing: 0,
      phase: rand() * 6,
    };
    ped.target = pickTarget(rand);
    world.scene.add(ped.mesh);
    world.peds.push(ped);
  }
}

function pickTarget(rand) {
  const road = ROADS[Math.floor(rand() * ROADS.length)];
  const horizontal = rand() < 0.5;
  const along = -190 + rand() * 380;
  const side = rand() < 0.5 ? -9.5 : 9.5;
  return new THREE.Vector3(
    horizontal ? along : road + side,
    0,
    horizontal ? road + side : along,
  );
}

export function updatePeds(world, dt) {
  const rand = world.pedRand;
  const playerPos = world.player.car ? world.player.car.pos : world.player.pos;
  const playerSpeed = world.player.car ? Math.abs(world.player.car.speed) : world.player.walkSpeed;
  for (const ped of world.peds) {
    // Flee when a fast car (or the player) gets close.
    const dPlayer = Math.hypot(ped.pos.x - playerPos.x, ped.pos.z - playerPos.z);
    if (dPlayer < 8 && playerSpeed > 4) ped.fleeing = 1.6;
    let tx, tz, speed;
    if (ped.fleeing > 0) {
      ped.fleeing -= dt;
      const away = Math.atan2(ped.pos.x - playerPos.x, ped.pos.z - playerPos.z);
      tx = ped.pos.x + Math.sin(away) * 10;
      tz = ped.pos.z + Math.cos(away) * 10;
      speed = 4.5;
    } else {
      if (!ped.target || Math.hypot(ped.target.x - ped.pos.x, ped.target.z - ped.pos.z) < 2) {
        ped.target = pickTarget(rand);
      }
      tx = ped.target.x;
      tz = ped.target.z;
      speed = ped.speed;
    }
    const dx = tx - ped.pos.x;
    const dz = tz - ped.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.05) {
      ped.heading = Math.atan2(dx, dz);
      ped.pos.x += (dx / dist) * speed * dt;
      ped.pos.z += (dz / dist) * speed * dt;
      ped.phase += dt * speed * 2.4;
    }
    ped.mesh.position.copy(ped.pos);
    ped.mesh.rotation.y = ped.heading;
    const swing = Math.sin(ped.phase) * 0.5;
    ped.mesh.userData.legL.rotation.x = swing;
    ped.mesh.userData.legR.rotation.x = -swing;
    // Hit by the player's car: wanted up, the ped is knocked down and gets up.
    if (world.player.car && dPlayer < 2.4 && Math.abs(world.player.car.speed) > 5 && ped.fleeing <= 0) {
      ped.fleeing = 2.5;
      ped.pos.x += (ped.pos.x - playerPos.x) * 0.4;
      ped.pos.z += (ped.pos.z - playerPos.z) * 0.4;
      world.addWanted(1);
      world.hud.toast('You hit a pedestrian!');
      world.audio.thud();
      world.shake = 0.3;
    }
  }
}
