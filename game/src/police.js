// The Coral Bay police: patrol cars that spawn at the city edge when Dana is
// wanted, chase her down, ram her car, and give up when the heat dies down.

import * as THREE from 'three';
import { makeCarMesh, pushOutOfColliders } from './cars.js';
import { ROADS, LAYOUT } from './city.js';

const MAX_COPS = 4;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function addWanted(world, n) {
  world.wanted = Math.max(0, Math.min(5, world.wanted + n));
  world.wantedTimer = 0;
}

function spawnCop(world) {
  const rand = world.copRand;
  const edge = Math.floor(rand() * 4);
  const road = ROADS[Math.floor(rand() * ROADS.length)];
  let x, z;
  if (edge === 0) { x = road; z = LAYOUT.min + 6; }
  else if (edge === 1) { x = road; z = LAYOUT.max - 6; }
  else if (edge === 2) { x = LAYOUT.min + 6; z = road; }
  else { x = LAYOUT.max - 6; z = road; }
  const cop = {
    mesh: makeCarMesh(0x1e2a3a, true),
    pos: new THREE.Vector3(x, 0, z),
    heading: 0,
    speed: 0,
    kind: 'police',
    driver: null,
  };
  world.scene.add(cop.mesh);
  world.cars.push(cop);
  world.cops.push(cop);
  return cop;
}

export function updatePolice(world, dt) {
  const target = world.player.car ? world.player.car.pos : world.player.pos;
  const targetSpeed = world.player.car ? Math.abs(world.player.car.speed) : world.player.walkSpeed;

  // More stars, more cars on the tail — up to four.
  const want = world.wanted > 0 ? Math.min(MAX_COPS, 1 + Math.floor(world.wanted / 2)) : 0;
  while (world.cops.length < want) spawnCop(world);

  // Heat fades when no cop can see Dana for a while.
  if (world.wanted > 0) {
    let nearest = Infinity;
    for (const cop of world.cops) {
      nearest = Math.min(nearest, Math.hypot(cop.pos.x - target.x, cop.pos.z - target.z));
    }
    if (nearest > 70 && targetSpeed < 3) {
      world.wantedTimer += dt;
      if (world.wantedTimer > 14) {
        addWanted(world, -1);
        world.hud.toast('The heat is cooling off…');
      }
    } else {
      world.wantedTimer = 0;
    }
  }

  for (const cop of [...world.cops]) {
    if (world.wanted === 0) {
      // Give up: drive away and despawn at the edge.
      cop.heading += dt * 0.6;
      cop.speed = Math.min(cop.speed + 8 * dt, 14);
      cop.pos.x += Math.sin(cop.heading) * cop.speed * dt;
      cop.pos.z += Math.cos(cop.heading) * cop.speed * dt;
      if (Math.abs(cop.pos.x) > 250 || Math.abs(cop.pos.z) > 250) {
        world.scene.remove(cop.mesh);
        world.cars.splice(world.cars.indexOf(cop), 1);
        world.cops.splice(world.cops.indexOf(cop), 1);
      }
      cop.mesh.position.copy(cop.pos);
      cop.mesh.rotation.y = cop.heading;
      continue;
    }
    // Chase: steer toward the player, faster with more stars.
    const dx = target.x - cop.pos.x;
    const dz = target.z - cop.pos.z;
    const dist = Math.hypot(dx, dz);
    const wantHeading = Math.atan2(dx, dz);
    let diff = wantHeading - cop.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cop.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const topSpeed = 15 + world.wanted * 2.4;
    cop.speed = Math.min(cop.speed + 10 * dt, topSpeed);
    cop.pos.x += Math.sin(cop.heading) * cop.speed * dt;
    cop.pos.z += Math.cos(cop.heading) * cop.speed * dt;
    pushOutOfColliders(world, cop.pos, 2.3);
    // Ramming: hit the player's car, slow it and shake the camera.
    if (dist < 3.4) {
      if (world.player.car && Math.abs(world.player.car.speed) > 1) {
        world.player.car.speed *= 0.55;
        world.audio.thud();
        world.shake = 0.45;
      }
      cop.speed *= 0.6;
    }
    cop.mesh.position.copy(cop.pos);
    cop.mesh.rotation.y = cop.heading;
  }
}
