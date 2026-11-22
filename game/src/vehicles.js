// Cars: the player's ride, parked cars waiting to be stolen, and traffic
// looping the road grid. Every car is boxes (body, cabin, four wheels), so the
// game needs no model files. Driving is arcade — W/S for speed, A/D to steer
// with authority that grows with speed, Space as the handbrake.
import * as THREE from 'three';
import { roadCenter, resolveBuildingCollision, HALF } from './city.js';

const PAINT_JOBS = [0xe63946, 0x457b9d, 0xf4d35e, 0x2a9d8f, 0xf4f1de, 0x6d597a, 0xee964b, 0x386641];

function carBody(color, policeCar) {
  const g = new THREE.Group();
  const shell = new THREE.MeshLambertMaterial({ color: policeCar ? 0x1b263b : color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), shell);
  body.position.y = 0.65;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.65, 2.1),
    new THREE.MeshLambertMaterial({ color: policeCar ? 0xf4f1de : 0x222831 }),
  );
  cabin.position.set(0, 1.3, -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  if (policeCar) {
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
  for (const [wx, wz] of [[-1, 1.45], [1, 1.45], [-1, -1.45], [1, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    g.add(wheel);
    g.userData.wheels.push(wheel);
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
    this.group = carBody(color, this.isPolice);
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
    const bar = this.group.userData.lightBar;
    if (bar) {
      // The light bar alternates red and blue twice a second.
      const red = Math.floor(performance.now() / 260) % 2 === 0;
      bar.material.emissive.setHex(red ? 0xff0000 : 0x2244ff);
      bar.material.color.setHex(red ? 0xff0000 : 0x2244ff);
    }
  }
}

export class VehicleManager {
  constructor(scene, city, rand) {
    this.scene = scene;
    this.city = city;
    this.rand = rand;
    this.cars = [];     // every car (player, parked, traffic, police)
    this.traffic = [];  // cars with traffic AI
    this.parked = [];   // parked, stealable cars
    this.playerCar = null;

    // Parked cars along road edges; the first sits by the player spawn for job 1.
    const bays = [
      [roadCenter(4) + 5.5, 108, Math.PI / 2],
      [roadCenter(4) - 5.5, 60, -Math.PI / 2],
      [roadCenter(2) + 5.5, -40, Math.PI / 2],
      [roadCenter(6) - 5.5, 145, -Math.PI / 2],
      [roadCenter(3) + 5.5, -145, Math.PI / 2],
      [roadCenter(5) - 5.5, 29, -Math.PI / 2],
      [roadCenter(1) + 5.5, 203, Math.PI / 2],
      [roadCenter(7) - 5.5, -203, -Math.PI / 2],
    ];
    for (const [x, z, h] of bays) {
      const car = new Vehicle(scene, x, z, h, PAINT_JOBS[Math.floor(rand() * PAINT_JOBS.length)]);
      this.cars.push(car);
      this.parked.push(car);
    }
    this.missionCar = this.parked[0];
  }

  spawnTraffic(n) {
    for (let i = 0; i < n; i++) {
      const alongRoad = this.rand() < 0.5;
      const lane = roadCenter(Math.floor(this.rand() * 9));
      const along = (this.rand() * 2 - 1) * (HALF - 20);
      const x = alongRoad ? along : lane;
      const z = alongRoad ? lane : along;
      const heading = alongRoad
        ? (this.rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2)
        : (this.rand() < 0.5 ? 0 : Math.PI);
      const car = new Vehicle(
        this.scene, x, z, heading,
        PAINT_JOBS[Math.floor(this.rand() * PAINT_JOBS.length)],
        { driver: 'traffic' },
      );
      car.cruise = 8 + this.rand() * 5;
      car.axis = alongRoad ? 'x' : 'z';
      this.cars.push(car);
      this.traffic.push(car);
    }
  }

  nearestStealable(pos, radius = 5) {
    let best = null;
    let bestD = radius;
    for (const car of this.parked) {
      if (car.isPlayer) continue;
      const d = Math.hypot(car.pos.x - pos.x, car.pos.z - pos.z);
      if (d < bestD) {
        best = car;
        bestD = d;
      }
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

  // Arcade driving for the player's car.
  drivePlayer(dt, input, onHardHit) {
    const car = this.playerCar;
    if (!car) return;
    const throttle = input.f ? 16 : 0;
    const brake = input.b ? 22 : 0;
    car.speed += (throttle - brake) * dt;
    if (!input.f && !input.b) car.speed *= Math.pow(0.4, dt);
    if (input.jump) car.speed *= Math.pow(0.05, dt); // handbrake
    car.speed = Math.max(-9, Math.min(30, car.speed));
    const steer = (input.l ? 1 : 0) - (input.r ? 1 : 0);
    const grip = Math.min(1, Math.abs(car.speed) / 8);
    car.heading += steer * 1.9 * grip * dt * Math.sign(car.speed || 1);
    const f = car.forward();
    car.pos.x += f.x * car.speed * dt;
    car.pos.z += f.z * car.speed * dt;
    const fixed = resolveBuildingCollision(this.city, car.pos.x, car.pos.z, 2.1);
    if (fixed.hit) {
      if (Math.abs(car.speed) > 12 && onHardHit) onHardHit(Math.abs(car.speed));
      car.speed *= -0.25;
      car.pos.x = fixed.x;
      car.pos.z = fixed.z;
    }
    // Stay inside the drivable area (city, beach and marina roads).
    car.pos.x = Math.max(-HALF - 10, Math.min(HALF + 55, car.pos.x));
    car.pos.z = Math.max(-HALF - 10, Math.min(HALF + 60, car.pos.z));
    car.sync();
  }

  // Traffic follows the grid, turns at crossings now and then, and brakes for
  // whatever is ahead — including the player.
  updateTraffic(dt, playerPos) {
    for (const car of this.traffic) {
      const f = car.forward();
      let target = car.cruise;
      for (const other of this.cars) {
        if (other === car) continue;
        const dx = other.pos.x - car.pos.x;
        const dz = other.pos.z - car.pos.z;
        const ahead = dx * f.x + dz * f.z;
        const side = Math.abs(dx * f.z - dz * f.x);
        if (ahead > 0 && ahead < 12 && side < 3) {
          target = 0;
          break;
        }
      }
      if (playerPos) {
        const d = Math.hypot(playerPos.x - car.pos.x, playerPos.z - car.pos.z);
        if (d < 9) target = Math.min(target, 3);
      }
      car.speed += (target - car.speed) * Math.min(1, dt * 2);
      car.pos.x += f.x * car.speed * dt;
      car.pos.z += f.z * car.speed * dt;
      // At a crossing, sometimes swing onto the crossing road.
      const crossings = Array.from({ length: 9 }, (_, i) => Math.abs(car.pos.z - roadCenter(i)));
      const nearCrossing = Math.min(...crossings) < 1.2
        && roadCenter(0) <= car.pos.x && car.pos.x <= roadCenter(8)
        && roadCenter(0) <= car.pos.z && car.pos.z <= roadCenter(8);
      if (nearCrossing && this.rand() < dt * 0.25) {
        car.heading += (this.rand() < 0.5 ? 1 : -1) * Math.PI / 2;
      }
      // Turn around at the edge instead of driving into the sea.
      if (car.pos.x < -HALF - 4 || car.pos.x > HALF + 50 || car.pos.z < -HALF - 4 || car.pos.z > HALF + 55) {
        car.heading += Math.PI;
      }
      car.sync();
    }
  }

  // Circle separation so cars never sit inside each other.
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
          a.pos.x -= dx * push;
          a.pos.z -= dz * push;
          b.pos.x += dx * push;
          b.pos.z += dz * push;
          if (!a.isPlayer) a.sync();
          if (!b.isPlayer) b.sync();
        }
      }
    }
  }
}
