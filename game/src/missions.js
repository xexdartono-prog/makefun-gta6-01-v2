// The three jobs: First Fare, Harbor Run and Bay Heist. Each mission is a
// small state machine with a glowing marker in the world, an objective line
// on the HUD and a payout. Finishing all three ends the game.

import * as THREE from 'three';
import { addWanted } from './police.js';

export function makeMarker(color) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3, 0.35, 8, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.4;
  group.add(ring);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 1.8, 30, 10, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
  );
  beam.position.y = 15;
  group.add(beam);
  group.userData.ring = ring;
  return group;
}

function atMarker(world, marker, radius = 4) {
  const p = world.player.car ? world.player.car.pos : world.player.pos;
  return Math.hypot(marker.position.x - p.x, marker.position.z - p.z) < radius;
}

export function createMissions(world) {
  const marker = makeMarker(0xffc93c);
  marker.visible = false;
  world.scene.add(marker);
  world.missions = {
    index: 0,            // 0 = First Fare, 1 = Harbor Run, 2 = Bay Heist, 3 = done
    stage: 'start',      // per-mission step
    marker,
    timer: 0,
    passenger: null,
    loot: null,
    earned: 0,
    checkpoint: 0,
    checkpoints: [],
    done: false,
  };
  setObjective(world, 'Get in the mission car — the coral one with the beacon.');
  marker.position.set(-146, 0, -146);
  marker.visible = true;
}

export function setObjective(world, text) {
  world.objective = text;
  if (world.hud) world.hud.setObjective(text);
}

function pay(world, amount, label) {
  world.money += amount;
  world.missions.earned += amount;
  world.hud.toast(`${label} +$${amount}`);
  world.audio.blip(880);
  world.save();
}

function nextMission(world) {
  world.missions.index++;
  world.missions.stage = 'start';
  world.missions.checkpoint = 0;
  if (world.missions.index === 1) {
    setObjective(world, 'Harbor Run: hit all 4 checkpoints before the timer runs out!');
    world.missions.stage = 'drive';
    world.missions.timer = 75;
    placeCheckpoints(world);
  } else if (world.missions.index === 2) {
    setObjective(world, 'Bay Heist: grab the loot at the harbor, then lose the cops.');
    world.missions.stage = 'grab';
    world.missions.marker.position.set(214, 0, 40);
    world.missions.marker.visible = true;
  } else {
    world.missions.done = true;
    world.missions.marker.visible = false;
    setObjective(world, 'All three jobs done — Coral Bay is yours, Dana.');
    world.hud.showDone(world.money);
    world.save();
  }
}

function placeCheckpoints(world) {
  // Four rings around the harbor yard, in driving order.
  const spots = [
    { x: 190, z: -120 },
    { x: 222, z: -20 },
    { x: 196, z: 80 },
    { x: 222, z: 150 },
  ];
  for (const m of world.missions.checkpoints) world.scene.remove(m);
  world.missions.checkpoints = [];
  for (const s of spots) {
    const ring = makeMarker(0xff7a3c);
    ring.position.set(s.x, 0, s.z);
    world.scene.add(ring);
    world.missions.checkpoints.push(ring);
  }
  world.missions.marker.visible = false;
}

export function updateMissions(world, dt) {
  const m = world.missions;
  if (m.done || !world.started || world.paused) return;
  const p = world.player;
  m.marker.userData.ring.rotation.z += dt * 0.8;

  if (m.index === 0) {
    if (m.stage === 'start') {
      // Wait until Dana is in the mission car.
      if (p.car && p.car.kind === 'mission') {
        m.stage = 'pickup';
        m.marker.position.set(-78, 0, -26);
        setObjective(world, 'Pick up the passenger at the yellow marker.');
        world.hud.toast('Passenger waiting — go get them.');
      }
    } else if (m.stage === 'pickup') {
      if (atMarker(world, m.marker)) {
        m.stage = 'dropoff';
        m.marker.position.set(78, 0, 130);
        setObjective(world, 'Drive the passenger to the hotel on the east side.');
        world.audio.blip(740);
        // The passenger hops in: a little figure that rides on the car.
        const rider = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 0.9, 0.5),
          new THREE.MeshLambertMaterial({ color: 0x4a90d8 }),
        );
        rider.position.set(0.55, 1.9, -0.4);
        p.car.mesh.add(rider);
        m.passenger = rider;
      }
    } else if (m.stage === 'dropoff') {
      if (atMarker(world, m.marker)) {
        if (m.passenger) {
          p.car.mesh.remove(m.passenger);
          m.passenger = null;
        }
        pay(world, 500, 'First Fare complete!');
        m.marker.visible = false;
        nextMission(world);
      }
    }
    return;
  }

  if (m.index === 1) {
    m.timer -= dt;
    world.hud.setObjective(`Harbor Run: checkpoint ${m.checkpoint + 1} of 4 — ${Math.max(0, Math.ceil(m.timer))}s left`);
    if (m.timer <= 0) {
      // Out of time: the run fails and restarts, keeping the money so far.
      m.timer = 75;
      m.checkpoint = 0;
      placeCheckpoints(world);
      world.hud.toast('Too slow! The run restarts — hit every ring.');
      setObjective(world, 'Harbor Run: hit all 4 checkpoints before the timer runs out!');
      return;
    }
    const ring = m.checkpoints[m.checkpoint];
    if (ring && atMarker(world, ring, 5)) {
      ring.visible = false;
      world.scene.remove(ring);
      m.checkpoint++;
      world.audio.blip(990);
      if (m.checkpoint >= 4) {
        pay(world, 800, 'Harbor Run complete!');
        for (const r of m.checkpoints) world.scene.remove(r);
        m.checkpoints = [];
        nextMission(world);
      }
    }
    return;
  }

  if (m.index === 2) {
    if (m.stage === 'grab') {
      if (atMarker(world, m.marker)) {
        m.stage = 'escape';
        m.marker.position.set(-182, 0, 182);
        setObjective(world, 'Got the loot! Reach the getaway point on the west edge — now!');
        addWanted(world, 3);
        world.hud.toast('The loot is yours — RUN. Wanted level 4!');
        world.audio.sirenBlip();
        // The loot bag rides on the car (or Dana's back on foot).
        const bag = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 0.6, 0.5),
          new THREE.MeshLambertMaterial({ color: 0x2a7a44 }),
        );
        bag.position.set(0, 2.2, 0);
        if (p.car) p.car.mesh.add(bag);
        else p.mesh.add(bag);
        m.loot = bag;
      }
    } else if (m.stage === 'escape') {
      if (atMarker(world, m.marker, 5)) {
        if (m.loot) {
          m.loot.parent?.remove(m.loot);
          m.loot = null;
        }
        pay(world, 1200, 'Bay Heist complete!');
        m.marker.visible = false;
        nextMission(world);
      }
    }
  }
}
