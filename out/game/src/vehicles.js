// Vehicles: the player's car, parked cars to steal, and traffic that loops the roads.
// Cars are built from boxes (body, cabin, wheels) so the whole game needs no assets.
// Driving is arcade: accelerate / brake / reverse on W/S, steering on A/D scaled by
// speed, handbrake on Space. Traffic follows the road grid and slows near the player.
import * as THREE from 'three';
import { roadCenter, resolveBuildingCollision, HALF } from './city.js';

const CAR_COLORS = [0xe63946, 0x457b9d, 0xf4d35e, 0x2a9d8f, 0xf4f1de, 0x6d597a, 0xee964b, 0x386641];

function buildCarMesh(color, isPolice = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: isPolice ? 0x1b263b : color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), bodyMat);
  body.position.y = 0.65;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.65, 2.1),
    new THREE.MeshLambertMaterial({ color: isPolice ? 0xf4f1de : 0x222831 }),
  );
  cabin.position.set(0, 1.3, -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  if (isPolice) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.22, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.8 }),
    );
    bar.position.set(0, 1.75, -0.2);
    g.add(bar);
    g.userData.lightBar = bar;
  }
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  g.userData.wheels = [];
  for (const [wx, wz] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w);
    g.userData.wheels.push(w);
  }
  return g;
}

export class Vehicle {
  constructor(scene, x, z, heading, color, opts = {}) {
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.color = color;
    this.isPolice = !!opts.police;
    this.isPlayer = false;
    this.driver = opts.driver ?? null; // 'traffic' | null (parked) | 'player'
    this.group = buildCarMesh(color, this.isPolice);
    this.group.position.copy(this.pos);
    this.group.rotation.y = heading;
    scene.add(this.group);
  }

  forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  sync() {
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
    if (this.group.userData.lightBar) {
      const m = this.group.userData.lightBar.material;
      m.emissive.setHex((Math.floor(performance.now() / 260) % 2 === 0) ? 0xff0000 : 0x2244ff);
      m.color.setHex((Math.floor(performance.now() / 260) % 2 === 0) ? 0xff0000 : 0x2244ff);
    }
  }
}

export class VehicleManager {
  constructor(scene, city, rand) {
    this.scene = scene;
    this.city = city;
    this.rand = rand;
    this.cars = [];     // every car in the world (player, parked, traffic, police)
    this.traffic = [];  // traffic cars with AI
    this.parked = [];   // parked, stealable cars
    this.playerCar = null;

    // Parked cars along road edges, one near the player spawn for mission 1.
    const spots = [
      [roadCenter(4) + 5.5, 108, Math.PI / 2],
      [roadCenter(4) - 5.5, 60, -Math.PI / 2],
      [roadCenter(2) + 5.5, -40, Math.PI / 2],
      [roadCenter(6) - 5.5, 145, -Math.PI / 2],
      [roadCenter(3) + 5.5, -145, Math.PI / 2],
      [roadCenter(5) - 5.5, 29, -Math.PI / 2],
      [roadCenter(1) + 5.5, 203, Math.PI / 2],
      [roadCenter(7) - 5.5, -203, -Math.PI / 2],
    ];
    for (const [x, z, h] of spots) {
      const c = new Vehicle(scene, x, z, h, CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)]);
      this.cars.push(c);
      this.parked.push(c);
    }
    // The mission-1 car is the closest one to the spawn; mark it so missions can find it.
    this.missionCar = this.parked[0];
  }

  spawnTraffic(n) {
    for (let i = 0; i < n; i++) {
      const axis = this.rand() < 0.5 ? 'x' : 'z';
      const lane = roadCenter(Math.floor(this.rand() * 9));
      const along = (this.rand() * 2 - 1) * (HALF - 20);
      const x = axis === 'x' ? along : lane;
      const z = axis === 'x' ? lane : along;
      const heading = axis === 'x' ? (this.rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2)
        : (this.rand() < 0.5 ? 0 : Math.PI);
      const c = new Vehicle(this.scene, x, z, heading, CAR_COLORS[Math.floor(this.rand() * CAR_COLORS.length)], { driver: 'traffic' });
      c.cruise = 8 + this.rand() * 5;
      c.axis = axis;
      this.cars.push(c);
      this.traffic.push(c);
    }
  }

  nearestStealable(pos, radius = 5) {
    let best = null;
    let bestD = radius;
    for (const c of this.parked) {
      if (c.isPlayer) continue;
      const d = Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z);
      if (d < bestD) { best = c; bestD = d; }
    }
    return best;
  }

  enterCar(player, car) {
    if (this.playerCar) return false;
    car.isPlayer = true;
    car.driver = 'player';
    this.playerCar = car;
    this.parked = this.parked.filter((c) => c !== car);
    player.inCar = car;
    player.group.visible = false;
    return true;
  }

  exitCar(player) {
    const car = this.playerCar;
    if (!car) return false;
    car.isPlayer = false;
    car.speed = 0;
    this.playerCar = null;
    player.inCar = null;
    const f = car.forward();
    player.teleport(car.pos.x - f.x * 3.2, car.pos.z - f.z * 3.2, car.heading);
    player.group.visible = true;
    return true;
  }

  // Arcade driving for the player's car; dt seconds.
  drivePlayer(dt, input, onHardHit) {
    const car = this.playerCar;
    if (!car) return;
    const accel = input.f ? 16 : 0;
    const brake = input.b ? 22 : 0;
    car.speed += (accel - brake) * dt;
    if (!input.f && !input.b) car.speed *= Math.pow(0.4, dt); // coast / drag
    if (input.jump) car.speed *= Math.pow(0.05, dt);          // handbrake
    car.speed = Math.max(-9, Math.min(30, car.speed));
    const steer = (input.l ? 1 : 0) - (input.r ? 1 : 0);
    const steerAuthority = Math.min(1, Math.abs(car.speed) / 8);
    car.heading += steer * 1.9 * steerAuthority * dt * Math.sign(car.speed || 1);
    const f = car.forward();
    car.pos.x += f.x * car.speed * dt;
    car.pos.z += f.z * car.speed * dt;
    const fixed = resolveBuildingCollision(this.city, car.pos.x, car.pos.z, 2.1);
    if (fixed.hit) {
      if (Math.abs(car.speed) > 12 && onHardHit) onHardHit(Math.abs(car.speed));
      car.speed *= -0.25; // bounce off the wall
      car.pos.x = fixed.x;
      car.pos.z = fixed.z;
    }
    // Keep the car inside the drivable area (city + beach + marina roads).
    car.pos.x = Math.max(-HALF - 10, Math.min(HALF + 55, car.pos.x));
    car.pos.z = Math.max(-HALF - 10, Math.min(HALF + 60, car.pos.z));
    car.sync();
  }

  // Traffic: follow the road grid, turn at intersections sometimes, slow for the player.
  updateTraffic(dt, playerPos) {
    for (const c of this.traffic) {
      const f = c.forward();
      // Slow down when something is right ahead.
      let target = c.cruise;
      for (const o of this.cars) {
        if (o === c) continue;
        const dx = o.pos.x - c.pos.x;
        const dz = o.pos.z - c.pos.z;
        const ahead = dx * f.x + dz * f.z;
        const side = Math.abs(dx * f.z - dz * f.x);
        if (ahead > 0 && ahead < 12 && side < 3) { target = 0; break; }
      }
      if (playerPos) {
        const d = Math.hypot(playerPos.x - c.pos.x, playerPos.z - c.pos.z);
        if (d < 9) target = Math.min(target, 3);
      }
      c.speed += (target - c.speed) * Math.min(1, dt * 2);
      c.pos.x += f.x * c.speed * dt;
      c.pos.z += f.z * c.speed * dt;
      // At a road crossing, sometimes turn onto the crossing road.
      const onRoadX = roadCenter(0) <= c.pos.x && c.pos.x <= roadCenter(8);
      const nearCrossing = roadCenter(0) <= c.pos.z && c.pos.z <= roadCenter(8)
        && Math.min(...Array.from({ length: 9 }, (_, i) => Math.abs(c.pos.z - roadCenter(i)))) < 1.2;
      if (nearCrossing && onRoadX && this.rand() < dt * 0.25) {
        c.heading += (this.rand() < 0.5 ? 1 : -1) * Math.PI / 2;
      }
      // Bounce back at the city edge instead of driving into the sea.
      if (c.pos.x < -HALF - 4 || c.pos.x > HALF + 50 || c.pos.z < -HALF - 4 || c.pos.z > HALF + 55) {
        c.heading += Math.PI;
      }
      c.sync();
    }
  }

  // Simple circle-vs-circle separation between all cars so they never overlap.
  separateCars() {
    for (let i = 0; i < this.cars.length; i++) {
      for (let j = i + 1; j < this.cars.length; j++) {
        const a = this.cars[i];
        const b = this.cars[j];
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.01 && d < 4.4) {
          const push = (4.4 - d) / 2 / d;
          a.pos.x -= dx * push; a.pos.z -= dz * push;
          b.pos.x += dx * push; b.pos.z += dz * push;
          if (!a.isPlayer) a.sync();
          if (!b.isPlayer) b.sync();
        }
      }
    }
  }
}
