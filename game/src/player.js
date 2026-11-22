// Dana Cruz on foot: her little blocky figure, walking and running, getting
// in and out of cars, punching, and the third-person camera that follows her.

import * as THREE from 'three';
import { pushOutOfColliders } from './cars.js';

function buildDana() {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b98a });
  const jacket = new THREE.MeshLambertMaterial({ color: 0xff5a3c });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2e4a6b });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1e1410 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.95, 0.45), jacket);
  torso.position.y = 1.15;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skin);
  head.position.y = 1.9;
  head.castShadow = true;
  g.add(head);
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.22, 0.54), hair);
  hairTop.position.y = 2.2;
  g.add(hairTop);
  const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.55, 0.14), hair);
  hairBack.position.set(0, 1.95, -0.26);
  g.add(hairBack);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.75, 0.36), jeans);
  legL.position.set(-0.22, 0.38, 0);
  legL.castShadow = true;
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.22;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.8, 0.3), jacket);
  armL.position.set(-0.58, 1.2, 0);
  armL.castShadow = true;
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.58;
  g.add(armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export function createPlayer(world) {
  const mesh = buildDana();
  const spawn = world.citySpawn;
  world.scene.add(mesh);
  world.player = {
    mesh,
    pos: new THREE.Vector3(spawn.x, 0, spawn.z),
    heading: spawn.heading,
    walkSpeed: 0,
    car: null,
    punchTimer: 0,
    stepPhase: 0,
  };
  mesh.position.copy(world.player.pos);
  mesh.rotation.y = world.player.heading;
}

// Find the nearest car Dana can get into (within reach, roughly in front).
export function nearestCar(world, maxDist = 4.2) {
  let best = null;
  let bestD = maxDist;
  for (const car of world.cars) {
    if (car.driver) continue;
    const d = Math.hypot(car.pos.x - world.player.pos.x, car.pos.z - world.player.pos.z);
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  return best;
}

export function enterCar(world, car) {
  world.player.car = car;
  car.driver = 'player';
  world.player.mesh.visible = false;
  world.missionBeacon.visible = car.kind !== 'mission';
  if (car.kind !== 'mission') {
    world.wanted = Math.min(5, world.wanted + 1);
    world.hud.toast('Car stolen — the cops are coming!');
    world.audio.sirenBlip();
  } else {
    world.hud.toast('Mission car — let\'s go, Dana.');
  }
  world.audio.blip(660);
}

export function exitCar(world) {
  const car = world.player.car;
  if (!car) return;
  car.driver = null;
  world.player.car = null;
  // Step out to the driver's side.
  const side = new THREE.Vector3(Math.cos(car.heading), 0, -Math.sin(car.heading));
  world.player.pos.set(car.pos.x + side.x * 2.2, 0, car.pos.z + side.z * 2.2);
  world.player.heading = car.heading;
  world.player.mesh.visible = true;
  world.player.mesh.position.copy(world.player.pos);
  world.player.mesh.rotation.y = world.player.heading;
}

export function updatePlayer(world, dt) {
  const p = world.player;
  if (p.car) return; // driving is handled by the car module
  const keys = world.keys;
  let fx = 0, fz = 0;
  if (keys.w) fz += 1;
  if (keys.s) fz -= 1;
  if (keys.a) fx -= 1;
  if (keys.d) fx += 1;
  const moving = fx !== 0 || fz !== 0;
  const run = keys.shift ? 8.5 : 5;
  if (moving) {
    const len = Math.hypot(fx, fz);
    fx /= len; fz /= len;
    // Movement is relative to the camera's facing, which trails Dana.
    // Forward on screen is (sin A, cos A) for camera heading A, and screen
    // right is (-cos A, sin A): move = forward * fz + right * fx.
    const camAngle = world.camHeading;
    const wx = fz * Math.sin(camAngle) - fx * Math.cos(camAngle);
    const wz = fz * Math.cos(camAngle) + fx * Math.sin(camAngle);
    p.pos.x += wx * run * dt;
    p.pos.z += wz * run * dt;
    p.heading = Math.atan2(wx, wz);
    p.walkSpeed = run;
    p.stepPhase += dt * run * 1.6;
  } else {
    p.walkSpeed = 0;
  }
  p.pos.x = Math.max(-240, Math.min(248, p.pos.x));
  p.pos.z = Math.max(-240, Math.min(252, p.pos.z));
  pushOutOfColliders(world, p.pos, 0.7);
  p.mesh.position.copy(p.pos);
  p.mesh.rotation.y = p.heading;
  // A simple walk cycle: legs and arms swing opposite each other.
  const swing = moving ? Math.sin(p.stepPhase) * 0.55 : 0;
  const { legL, legR, armL, armR } = p.mesh.userData;
  legL.rotation.x = swing;
  legR.rotation.x = -swing;
  armL.rotation.x = -swing * 0.8;
  armR.rotation.x = swing * 0.8;
  if (p.punchTimer > 0) {
    p.punchTimer -= dt;
    armR.rotation.x = -1.4;
  }
}

// The camera trails behind Dana (or her car), smoothed, and drags with the mouse.
export function updateCamera(world, dt) {
  const target = world.player.car ? world.player.car.pos : world.player.pos;
  const heading = world.player.car ? world.player.car.heading : world.player.heading;
  const dist = world.player.car ? 13 : 9.5;
  const height = world.player.car ? 5.5 : 4.6;
  // Mouse drag orbits the camera around the player.
  world.camHeading += world.mouseDX * 0.004;
  world.mouseDX = 0;
  // While moving, ease the camera back behind the direction of travel so
  // it trails Dana (or her car) instead of staying stuck at a side angle.
  const moving = world.player.car ? Math.abs(world.player.car.speed) > 2 : world.player.walkSpeed > 0.5;
  if (moving) {
    let diff = heading - world.camHeading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    world.camHeading += diff * Math.min(1, dt * 1.6);
  }
  const desired = new THREE.Vector3(
    target.x - Math.sin(world.camHeading) * dist,
    height,
    target.z - Math.cos(world.camHeading) * dist,
  );
  world.camera.position.lerp(desired, Math.min(1, dt * 5));
  if (world.shake > 0) {
    world.shake -= dt;
    world.camera.position.x += (Math.random() - 0.5) * world.shake * 0.5;
    world.camera.position.y += (Math.random() - 0.5) * world.shake * 0.5;
  }
  world.camera.lookAt(target.x, target.y + 1.6, target.z);
  world.camTargetHeading = heading;
}
