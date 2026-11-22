// Shot mode: deterministic frozen poses for the four screenshots, chosen
// with ?shot=cover|drive|mission|chase. Each pose starts the game, places
// Dana and the world exactly, then freezes the simulation so the capture is
// the same every time. The page sets window.__shotReady once the first
// frame after the pose is on screen.

import * as THREE from 'three';
import { makeCarMesh } from './cars.js';
import { addWanted } from './police.js';
import { makeMarker } from './missions.js';

function putDanaInMissionCar(world) {
  const car = world.missionCar;
  world.player.car = car;
  car.driver = 'player';
  world.player.mesh.visible = false;
  world.missionBeacon.visible = false;
}

function spawnCopAt(world, x, z, heading) {
  const cop = {
    mesh: makeCarMesh(0x1e2a3a, true),
    pos: new THREE.Vector3(x, 0, z),
    heading,
    speed: 0,
    kind: 'police',
    driver: null,
  };
  world.scene.add(cop.mesh);
  world.cars.push(cop);
  world.cops.push(cop);
  cop.mesh.position.copy(cop.pos);
  cop.mesh.rotation.y = heading;
  return cop;
}

// Put the camera exactly on the pose at once: the loop's lerp would take
// several frames to travel from the origin, and a screenshot must not catch
// it mid-flight.
function snapCamera(world) {
  const target = world.player.car ? world.player.car.pos : world.player.pos;
  const dist = world.player.car ? 13 : 9.5;
  const height = world.player.car ? 5.5 : 4.6;
  world.camera.position.set(
    target.x - Math.sin(world.camHeading) * dist,
    height,
    target.z - Math.cos(world.camHeading) * dist,
  );
  world.camera.lookAt(target.x, target.y + 1.6, target.z);
}

export function applyShot(world, name) {
  const p = world.player;
  if (name === 'cover') {
    // Dana on foot at the south end of a road, the city rising behind her.
    p.pos.set(-78, 0, 150);
    p.heading = Math.PI;
    p.mesh.position.copy(p.pos);
    p.mesh.rotation.y = p.heading;
    world.camHeading = Math.PI;
    world.missions.marker.position.set(-78, 0, 120);
    world.missions.marker.visible = true;
    world.hud.setObjective('Get in the mission car — the coral one with the beacon.');
  } else if (name === 'drive') {
    putDanaInMissionCar(world);
    const car = world.missionCar;
    car.pos.set(-26, 0, 60);
    car.heading = 0;
    car.speed = 16;
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = 0;
    addWanted(world, 2);
    world.hud.setObjective('Pick up the passenger at the yellow marker.');
    world.missions.marker.position.set(-26, 0, -26);
    world.missions.marker.visible = true;
    world.speedKmh = 58;
    world.camHeading = 0;
  } else if (name === 'mission') {
    putDanaInMissionCar(world);
    const car = world.missionCar;
    // South of the first checkpoint ring, facing straight at it (north),
    // so the ring, the yard and the timer all read in one frame. (Ring 1
    // sits at z=-120; the car starts 32 units south of it.)
    car.pos.set(190, 0, -88);
    car.heading = Math.PI;
    car.speed = 11;
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = Math.PI;
    world.missions.index = 1;
    world.missions.stage = 'drive';
    world.missions.timer = 61;
    world.missions.checkpoint = 0;
    world.missions.marker.visible = false;
    const spots = [
      { x: 190, z: -120 },
      { x: 222, z: -20 },
      { x: 196, z: 80 },
      { x: 222, z: 150 },
    ];
    world.missions.checkpoints = [];
    for (const s of spots) {
      const ring = makeMarker(0xff7a3c);
      ring.position.set(s.x, 0, s.z);
      ring.visible = true;
      world.scene.add(ring);
      world.missions.checkpoints.push(ring);
    }
    world.hud.setObjective('Harbor Run: checkpoint 1 of 4 — 61s left');
    world.speedKmh = 41;
    world.camHeading = Math.PI;
  } else if (name === 'chase') {
    putDanaInMissionCar(world);
    const car = world.missionCar;
    car.pos.set(-78, 0, 182);
    car.heading = Math.PI / 2;
    car.speed = 24;
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = Math.PI / 2;
    addWanted(world, 4);
    spawnCopAt(world, -70, 168, Math.PI / 2);
    spawnCopAt(world, -88, 196, Math.PI / 2);
    world.money = 800;
    world.missions.index = 2;
    world.missions.stage = 'escape';
    world.missions.marker.position.set(-182, 0, 182);
    world.missions.marker.visible = true;
    world.hud.setObjective('Got the loot! Reach the getaway point — now!');
    world.speedKmh = 86;
    world.camHeading = Math.PI / 2;
  }
  // Freeze the simulation, snap the camera onto the pose, and let the
  // renderer draw it before the page reports ready.
  world.frozen = true;
  world.started = true;
  world.hud.root.classList.remove('hidden');
  world.hud.startScreen.classList.add('hidden');
  snapCamera(world);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.__shotReady = true;
    });
  });
}
