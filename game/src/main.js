// CORAL BAY — bootstrap and the game loop. This file wires every system
// together: the city, the cars, Dana, the pedestrians, the police, the
// missions, the HUD, the sound and the save. It owns the world object every
// module reads and writes.

import * as THREE from 'three';
import { createCity } from './city.js';
import { createCars, updateDriving, updateTraffic } from './cars.js';
import { createPlayer, updatePlayer, updateCamera, nearestCar, enterCar, exitCar } from './player.js';
import { createPeds, updatePeds } from './people.js';
import { updatePolice, addWanted } from './police.js';
import { createMissions, updateMissions } from './missions.js';
import { createHud, updateHud } from './hud.js';
import { SoundEngine } from './audio.js';
import { applyShot } from './shots.js';
import { loadSave, writeSave, clearSave } from './save.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

// The world: one object every system shares.
const world = {
  scene,
  camera,
  renderer,
  time: 0,
  started: false,
  paused: false,
  frozen: false,
  money: 0,
  wanted: 0,
  wantedTimer: 0,
  speedKmh: 0,
  shake: 0,
  objective: '',
  keys: { w: false, a: false, s: false, d: false, shift: false },
  mouseDX: 0,
  camHeading: 0,
  camTargetHeading: 0,
  colliders: [],
  cars: [],
  traffic: [],
  peds: [],
  cops: [],
  player: null,
  missionCar: null,
  missionBeacon: null,
  missions: null,
  hud: null,
  audio: new SoundEngine(),
  trafficRand: mulberry32(2026),
  pedRand: mulberry32(5150),
  copRand: mulberry32(8080),
  save: () => writeSave(world),
  addWanted: (n) => addWanted(world, n),
};
window.__game = world;
window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message)));

// Build the world: city first (it lays out the colliders and the spawn),
// then the cars, Dana, the pedestrians, the missions and the HUD.
const city = createCity(world);
world.citySpots = city.parkingSpots;
world.citySpawn = city.playerSpawn;
createCars(world);
createPlayer(world);
createPeds(world);
createHud(world);
createMissions(world);
world.camHeading = world.player.heading;

// A saved game offers Continue on the start screen.
const saved = loadSave();
if (saved && saved.money > 0) {
  world.hud.continueBtn.classList.remove('hidden');
  world.hud.continueBtn.textContent = `CONTINUE — $${saved.money} BANKED`;
}

function startGame(fromSave) {
  world.audio.unlock();
  if (fromSave && saved) {
    world.money = saved.money;
    world.missions.index = Math.min(saved.missionsDone || 0, 2);
  }
  world.started = true;
  world.hud.startScreen.classList.add('hidden');
  world.hud.root.classList.remove('hidden');
  world.hud.toast('Welcome back to Coral Bay, Dana.');
}

// Input: keyboard, mouse drag to look, click to punch.
const KEYMAP = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', ShiftLeft: 'shift', ShiftRight: 'shift' };
window.addEventListener('keydown', (e) => {
  const key = KEYMAP[e.code];
  if (key) world.keys[key] = true;
  if (e.code === 'KeyE' && !e.repeat && world.started && !world.paused) {
    if (world.player.car) exitCar(world);
    else {
      const car = nearestCar(world);
      if (car) enterCar(world, car);
    }
  }
  if (e.code === 'KeyF' && !e.repeat && world.started && !world.paused) punch(world);
  if ((e.code === 'KeyP' || e.code === 'Escape') && world.started && !world.missions.done) {
    world.paused = !world.paused;
    world.hud.pauseScreen.classList.toggle('hidden', !world.paused);
  }
});
window.addEventListener('keyup', (e) => {
  const key = KEYMAP[e.code];
  if (key) world.keys[key] = false;
});

let dragging = false;
let lastX = 0;
renderer.domElement.addEventListener('mousedown', (e) => {
  dragging = true;
  lastX = e.clientX;
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  world.mouseDX += e.clientX - lastX;
  lastX = e.clientX;
});
window.addEventListener('mouseup', () => { dragging = false; });
renderer.domElement.addEventListener('click', () => {
  if (world.started && !world.paused && !world.player.car) punch(world);
});

function punch(world) {
  const p = world.player;
  if (p.car || p.punchTimer > 0) return;
  p.punchTimer = 0.35;
  world.audio.thud();
  for (const ped of world.peds) {
    const d = Math.hypot(ped.pos.x - p.pos.x, ped.pos.z - p.pos.z);
    if (d < 2.6) {
      ped.fleeing = 2.5;
      ped.pos.x += (ped.pos.x - p.pos.x) * 0.6;
      ped.pos.z += (ped.pos.z - p.pos.z) * 0.6;
      world.addWanted(1);
      world.hud.toast('You punched a pedestrian — the cops noticed!');
      break;
    }
  }
}

world.hud.startBtn.addEventListener('click', () => startGame(false));
world.hud.continueBtn.addEventListener('click', () => startGame(true));
world.hud.resumeBtn.addEventListener('click', () => {
  world.paused = false;
  world.hud.pauseScreen.classList.add('hidden');
});
world.hud.againBtn.addEventListener('click', () => {
  clearSave();
  window.location.reload();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Shot mode: a frozen pose for screenshots, driven by ?shot=.
const shotName = new URLSearchParams(window.location.search).get('shot');
if (shotName && ['cover', 'drive', 'mission', 'chase'].includes(shotName)) {
  world.audio.unlock();
  applyShot(world, shotName);
}

// The loop: simulate, then draw. A frozen shot or a pause draws only.
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (world.started && !world.paused && !world.frozen) {
    world.time += dt;
    updatePlayer(world, dt);
    updateDriving(world, dt);
    updateTraffic(world, dt);
    updatePeds(world, dt);
    updatePolice(world, dt);
    updateMissions(world, dt);
    world.audio.update(world, dt);
  }
  // The HUD refreshes even in a frozen shot, so the stars, money, speed
  // and minimap show the pose's values instead of the initial ones.
  if (world.started && !world.paused) updateHud(world);
  updateCamera(world, dt);
  renderer.render(scene, camera);
}
loop();
