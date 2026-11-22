// Cars: the factory that builds a car mesh, the driving model for the car
// the player is in, the parked cars around the city, and the traffic that
// cruises the road grid.

import * as THREE from 'three';
import { ROADS, LAYOUT } from './city.js';

const CAR_COLORS = [0xc23b2e, 0x2e6fc2, 0xe8c13a, 0x3aa655, 0x7a4a9e, 0xd8d8d8, 0x222831, 0xe87a2e];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A car is a body box, a cabin box, four cylinder wheels and two headlights.
// The body colour is the only thing that changes between cars.
export function makeCarMesh(color, isPolice = false) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), bodyMat);
  body.position.y = 0.65;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.7, 2.2),
    new THREE.MeshLambertMaterial({ color: 0x1c2733 }),
  );
  cabin.position.set(0, 1.3, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  for (const [wx, wz] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.22, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x2244ff, emissiveIntensity: 0.7 }),
    );
    bar.position.set(0, 1.75, -0.2);
    group.add(bar);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.12, 0.3, 4.42),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
    );
    stripe.position.y = 0.62;
    group.add(stripe);
  } else {
    for (const hx of [-0.7, 0.7]) {
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.2, 0.1),
        new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffe9a0, emissiveIntensity: 0.5 }),
      );
      lamp.position.set(hx, 0.7, 2.22);
      group.add(lamp);
    }
  }
  return group;
}

function newCar(color, x, z, heading, kind) {
  return {
    mesh: makeCarMesh(color, kind === 'police'),
    pos: new THREE.Vector3(x, 0, z),
    heading,
    speed: 0,
    steer: 0,
    kind, // 'mission' | 'parked' | 'traffic' | 'police'
    color,
    driver: null, // 'player' when Dana is inside
    stuck: 0,
  };
}

// Circle-vs-AABB push-out, shared by cars and the player on foot.
export function pushOutOfColliders(world, pos, radius) {
  for (const c of world.colliders) {
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      pos.x = cx + (dx / d) * radius;
      pos.z = cz + (dz / d) * radius;
      return true;
    }
    if (d2 <= 0.0001) {
      // Centre inside the box: push out along the shortest face.
      const left = pos.x - c.minX, right = c.maxX - pos.x;
      const top = pos.z - c.minZ, bottom = c.maxZ - pos.z;
      const m = Math.min(left, right, top, bottom);
      if (m === left) pos.x = c.minX - radius;
      else if (m === right) pos.x = c.maxX + radius;
      else if (m === top) pos.z = c.minZ - radius;
      else pos.z = c.maxZ + radius;
      return true;
    }
  }
  return false;
}

export function createCars(world) {
  const rand = mulberry32(99);
  // The mission car: bright coral, parked near Dana's spawn, with a beacon.
  const mission = newCar(0xff5a3c, -146, -146, Math.PI * 0.75, 'mission');
  world.scene.add(mission.mesh);
  world.cars.push(mission);
  world.missionCar = mission;

  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.35 });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.6, 26, 10, 1, true), beaconMat);
  beacon.position.set(-146, 13, -146);
  world.scene.add(beacon);
  world.missionBeacon = beacon;

  // Parked cars on the spots the city laid out.
  const spots = world.citySpots.slice(0, 10);
  for (const s of spots) {
    const car = newCar(CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)], s.x, s.z, s.heading, 'parked');
    world.scene.add(car.mesh);
    world.cars.push(car);
  }

  // Traffic: ten cars cruising the grid, each on its own road and lane.
  for (let i = 0; i < 10; i++) {
    const horizontal = rand() < 0.5;
    const road = ROADS[Math.floor(rand() * ROADS.length)];
    const along = -190 + rand() * 380;
    const lane = (rand() < 0.5 ? -3 : 3);
    const car = newCar(
      CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)],
      horizontal ? along : road + lane,
      horizontal ? road + lane : along,
      horizontal ? (rand() < 0.5 ? 0 : Math.PI) : (rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      'traffic',
    );
    car.speed = 7 + rand() * 4;
    car.axis = horizontal ? 'x' : 'z';
    car.road = road;
    car.lane = lane;
    world.scene.add(car.mesh);
    world.cars.push(car);
    world.traffic.push(car);
  }
}

// Arcade driving: accelerate, brake, steer harder at low speed, drag.
export function updateDriving(world, dt) {
  const car = world.player.car;
  if (!car) return;
  const keys = world.keys;
  const accel = (keys.w ? 14 : 0) - (keys.s ? 18 : 0);
  car.speed += accel * dt;
  car.speed *= Math.max(0, 1 - 0.9 * dt);
  if (Math.abs(car.speed) < 0.15 && !keys.w && !keys.s) car.speed = 0;
  car.speed = Math.max(-9, Math.min(26, car.speed));
  const steerInput = (keys.a ? 1 : 0) - (keys.d ? 1 : 0);
  // Steering flips when reversing, so one sign factor here is enough.
  const steerAmount = steerInput * 1.5 * Math.min(1, Math.abs(car.speed) / 8);
  car.heading += steerAmount * dt * (car.speed >= 0 ? 1 : -1) * 0.9;
  const dx = Math.sin(car.heading) * car.speed * dt;
  const dz = Math.cos(car.heading) * car.speed * dt;
  car.pos.x += dx;
  car.pos.z += dz;
  // Stay in the playable area (the beach and the yard are open ground).
  car.pos.x = Math.max(-240, Math.min(248, car.pos.x));
  car.pos.z = Math.max(-240, Math.min(252, car.pos.z));
  const hit = pushOutOfColliders(world, car.pos, 2.3);
  if (hit && Math.abs(car.speed) > 6) {
    world.audio.thud();
    car.speed *= 0.45;
    world.shake = 0.35;
  }
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = car.heading;
  world.speedKmh = Math.abs(car.speed) * 3.6;
}

// Traffic follows its road, turns at intersections sometimes, and never
// leaves the grid: at the edge it turns around.
export function updateTraffic(world, dt) {
  const rand = world.trafficRand;
  for (const car of world.traffic) {
    const speed = car.speed;
    let dx = 0, dz = 0;
    if (car.axis === 'x') {
      dx = Math.sin(car.heading) * speed * dt;
    } else {
      dz = Math.cos(car.heading) * speed * dt;
    }
    car.pos.x += dx;
    car.pos.z += dz;
    // At an intersection, sometimes turn onto the cross street.
    const nearX = ROADS.some((r) => Math.abs(car.pos.x - r) < 1.2);
    const nearZ = ROADS.some((r) => Math.abs(car.pos.z - r) < 1.2);
    if (nearX && nearZ && rand() < dt * 0.25) {
      if (car.axis === 'x') {
        car.axis = 'z';
        car.road = car.pos.z;
        car.heading = rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.axis = 'x';
        car.road = car.pos.x;
        car.heading = rand() < 0.5 ? 0 : Math.PI;
      }
      // Snap onto the lane of the new road.
      if (car.axis === 'x') car.pos.z = car.road + car.lane;
      else car.pos.x = car.road + car.lane;
    }
    // Turn around at the city's edge instead of driving into the sea.
    if (car.pos.x > LAYOUT.max || car.pos.x < LAYOUT.min || car.pos.z > LAYOUT.max || car.pos.z < LAYOUT.min) {
      car.heading += Math.PI;
      car.pos.x = Math.max(LAYOUT.min, Math.min(LAYOUT.max, car.pos.x));
      car.pos.z = Math.max(LAYOUT.min, Math.min(LAYOUT.max, car.pos.z));
    }
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = car.heading;
  }
}
