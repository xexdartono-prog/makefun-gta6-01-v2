// CORAL BAY — bootstrap and the one game loop.
// Wires the city, Dana, cars, police, missions, HUD, sound and saves together,
// reads keyboard + mouse, chases the player with a third-person camera, and
// runs the state machine: menu -> playing -> busted / job complete -> menu.
// In shot mode (?shot=start|drive|mission|chase) the menu is skipped and the
// game is posed for a screenshot, then window.__shotReady is set.
import * as THREE from 'three';
import { buildCity, mulberry32 } from './city.js';
import { Player } from './player.js';
import { VehicleManager } from './vehicles.js';
import { Pedestrians } from './peds.js';
import { Police } from './police.js';
import { Missions, JOBS } from './missions.js';
import { HUD } from './hud.js';
import { AudioSys } from './audio.js';
import { loadSave, saveSave } from './save.js';
import { shotFromUrl, applyShot } from './shots.js';

const rand = mulberry32(20261123);

// --- renderer and scene -----------------------------------------------------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x9fd8e8, 160, 720);

const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d9, 1.7);
sun.position.set(180, 260, 120);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -280;
sun.shadow.camera.right = 280;
sun.shadow.camera.top = 280;
sun.shadow.camera.bottom = -280;
sun.shadow.camera.far = 800;
scene.add(sun);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

// --- world ------------------------------------------------------------------
const city = buildCity(scene);
const player = new Player(scene);
player.teleport(city.landmarks.playerSpawn.x, city.landmarks.playerSpawn.z, Math.PI);
const vehicles = new VehicleManager(scene, city, rand);
vehicles.spawnTraffic(12);
const peds = new Pedestrians(scene, city, rand);
peds.spawn(16);
const police = new Police(scene, city);
const missions = new Missions(scene, city.landmarks);
const hud = new HUD();
const audio = new AudioSys();

const bank = { money: 0 };
const save = loadSave();
bank.money = save.money;
if (save.job >= 0 && save.job < JOBS.length) missions.startJob(save.job);

// --- input ------------------------------------------------------------------
const keys = new Set();
const input = { f: false, b: false, l: false, r: false, jump: false, punch: false, sprint: false };
let camYaw = 0; // camera starts behind Dana (she faces -Z, toward the car)
let camPitch = 0.32;
let camDist = 10;
let camHeight = 4.5;
let lastDrag = 0;

function readKeys() {
  input.f = keys.has('KeyW') || keys.has('ArrowUp');
  input.b = keys.has('KeyS') || keys.has('ArrowDown');
  input.l = keys.has('KeyA') || keys.has('ArrowLeft');
  input.r = keys.has('KeyD') || keys.has('ArrowRight');
  input.jump = keys.has('Space');
  input.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'KeyF') input.punch = true;
  if (e.code === 'KeyE') onEnterKey();
  if (e.code === 'KeyR') restartMission();
  if (e.code === 'Escape') togglePause();
  if (e.code === 'Space') e.preventDefault();
  readKeys();
});
window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
  readKeys();
});

let dragging = false;
let dragX = 0;
let dragY = 0;
renderer.domElement.addEventListener('pointerdown', (e) => {
  dragging = true;
  dragX = e.clientX;
  dragY = e.clientY;
});
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - dragX;
  const dy = e.clientY - dragY;
  dragX = e.clientX;
  dragY = e.clientY;
  camYaw -= dx * 0.005;
  camPitch = Math.max(0.08, Math.min(1.1, camPitch + dy * 0.004));
  lastDrag = performance.now();
});
window.addEventListener('pointerup', () => { dragging = false; });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- state machine ----------------------------------------------------------
let state = 'menu'; // menu | playing | paused | busted | complete
const menuEl = document.getElementById('menu');
const bustedEl = document.getElementById('busted');
const completeEl = document.getElementById('complete');
const startBtn = document.getElementById('startBtn');
const continueBtn = document.getElementById('continueBtn');
const retryBtn = document.getElementById('retryBtn');
const nextBtn = document.getElementById('nextBtn');

if (save.job > 0 && save.job < JOBS.length) continueBtn.style.display = '';
continueBtn.addEventListener('click', () => {
  audio.ensure();
  missions.startJob(save.job);
  beginPlay();
});
startBtn.addEventListener('click', () => {
  audio.ensure();
  if (save.job >= JOBS.length) {
    bank.money = save.money;
    missions.startJob(0);
  }
  beginPlay();
});
retryBtn.addEventListener('click', () => {
  bustedEl.classList.add('hidden');
  restartMission();
  beginPlay();
});
nextBtn.addEventListener('click', () => {
  completeEl.classList.add('hidden');
  if (missions.done) {
    state = 'menu';
    menuEl.classList.remove('hidden');
  } else {
    beginPlay();
  }
});

function beginPlay() {
  menuEl.classList.add('hidden');
  bustedEl.classList.add('hidden');
  completeEl.classList.add('hidden');
  state = 'playing';
  hud.toast(missions.job ? missions.job.intro : 'Free roam — Coral Bay is yours.');
}

function togglePause() {
  if (state === 'playing') {
    state = 'paused';
    menuEl.classList.remove('hidden');
    continueBtn.style.display = '';
    saveSave({ money: bank.money, job: missions.index, finished: [] });
  } else if (state === 'paused') {
    beginPlay();
  }
}

function restartMission() {
  police.clear();
  if (vehicles.playerCar) vehicles.exitCar(player);
  player.health = 100;
  player.teleport(city.landmarks.playerSpawn.x, city.landmarks.playerSpawn.z, Math.PI);
  missions.startJob(missions.index);
  saveSave({ money: bank.money, job: missions.index, finished: [] });
}

function onEnterKey() {
  if (state !== 'playing') return;
  audio.ensure();
  if (player.inCar) {
    vehicles.exitCar(player);
    return;
  }
  const car = vehicles.nearestStealable(player.pos, 5);
  if (car) {
    const stealing = car !== vehicles.missionCar || missions.job.steps[missions.step].kind !== 'car';
    vehicles.enterCar(player, car);
    if (stealing) {
      police.addWanted(1);
      hud.toast('STOLEN! The heat is on.');
    }
    audio.blip(220, 0.12, 'square', 0.12);
  }
}

// --- camera -----------------------------------------------------------------
function setCamera(x, z, heading, dist, height) {
  camYaw = heading + Math.PI;
  camPitch = 0.32;
  camDist = dist;
  camHeight = height;
  camera.position.set(x + Math.sin(camYaw) * dist, height, z + Math.cos(camYaw) * dist);
  camera.lookAt(x, 2, z);
}

function followCamera(dt) {
  const target = player.inCar ? player.inCar.pos : player.pos;
  const heading = player.inCar ? player.inCar.heading : player.heading;
  // Driving with a still mouse: ease the camera around behind the car.
  if (player.inCar && performance.now() - lastDrag > 1500) {
    const want = heading + Math.PI;
    let diff = want - camYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    camYaw += diff * Math.min(1, dt * 1.6);
    camDist += (13 - camDist) * Math.min(1, dt * 2);
    camHeight += (6 - camHeight) * Math.min(1, dt * 2);
  } else if (!player.inCar) {
    camDist += (10 - camDist) * Math.min(1, dt * 2);
    camHeight += (4.5 - camHeight) * Math.min(1, dt * 2);
  }
  const fx = -Math.sin(camYaw);
  const fz = -Math.cos(camYaw);
  const cx = target.x - fx * camDist;
  const cz = target.z - fz * camDist;
  const cy = Math.max(2.2, (player.inCar ? 1.2 : 2.2) + Math.sin(camPitch) * camDist * 0.7 + camHeight * 0.4);
  camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 8);
  camera.position.y += (cy - camera.position.y) * Math.min(1, dt * 8);
  camera.position.z += (cz - camera.position.z) * Math.min(1, dt * 8);
  camera.lookAt(target.x + fx * 7, 2, target.z + fz * 7);
}

// --- shot mode --------------------------------------------------------------
const shot = shotFromUrl();
if (shot) {
  menuEl.classList.add('hidden');
  state = 'playing';
  const ctx = {
    player,
    vehicles,
    police,
    missions,
    money: bank.money,
    toast: (t) => hud.toast(t),
    setCamera: (x, z, h, d, ht) => setCamera(x, z, h, d, ht),
  };
  const label = applyShot(shot, ctx);
  bank.money = ctx.money;
  window.__shotName = label || 'unknown';
}

// --- errors, for headless testing -------------------------------------------
window.__errors = [];
window.addEventListener('error', (e) => {
  window.__errors.push(String(e.message));
});

// --- main loop --------------------------------------------------------------
const clock = new THREE.Clock();
let frames = 0;
window.__game = { player, vehicles, peds, police, missions, bank, get state() { return state; } };

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  frames += 1;

  if (state === 'playing') {
    readKeys();
    const inCar = !!player.inCar;

    // Shot mode freezes the pose: no driving, no police chase, no mission
    // progress — traffic and pedestrians keep moving so the frame stays alive,
    // and the camera still eases onto its posed spot.
    if (!shot) {
      if (!inCar) {
        // Dana on foot: walk, jump, punch. Peds are the hittables.
        const standing = peds.list.filter((p) => !p.fallen);
        player.update(dt, input, camYaw, city, standing, (ped) => {
          peds.fall(ped);
          police.addWanted(1);
          audio.punch();
          if (rand() < 0.5) {
            bank.money += 20;
            hud.toast('+$20 pocket money');
          } else {
            hud.toast('He won’t forget that.');
          }
        });
        input.punch = false;
      } else {
        vehicles.drivePlayer(dt, input, () => {
          player.health = Math.max(0, player.health - 5);
          audio.crash();
          hud.toast('Ouch — that wall came out of nowhere.');
        });
        input.punch = false;
      }

      // The player's car running a pedestrian down: they fall, the law notices.
      if (vehicles.playerCar) {
        const car = vehicles.playerCar;
        for (const ped of peds.list) {
          if (ped.fallen) continue;
          if (Math.hypot(ped.pos.x - car.pos.x, ped.pos.z - car.pos.z) < 2.6 && Math.abs(car.speed) > 3) {
            peds.fall(ped);
            police.addWanted(2);
            audio.crash();
            hud.toast('You hit a pedestrian! Wanted up.');
          }
        }
      }
    }

    // Traffic, pedestrians, police.
    vehicles.updateTraffic(dt, player.inCar ? player.inCar.pos : player.pos);
    vehicles.separateCars();
    const threats = [];
    if (input.punch) threats.push({ x: player.pos.x, z: player.pos.z, radius: 7 });
    if (vehicles.playerCar && Math.abs(vehicles.playerCar.speed) > 5) {
      threats.push({ x: vehicles.playerCar.pos.x, z: vehicles.playerCar.pos.z, radius: 8 });
    }
    peds.update(dt, threats);
    const target = player.inCar
      ? { pos: player.inCar.pos, inCar: true, speed: player.inCar.speed }
      : { pos: player.pos, inCar: false, speed: player.speed };
    // Frozen in shot mode: the posed cops stay where the shot put them.
    const outcome = shot
      ? null
      : police.update(dt, target, vehicles, () => {
        player.health = Math.max(0, player.health - 8);
        audio.crash();
      });
    if (!shot && (outcome === 'busted' || player.health <= 0)) {
      state = 'busted';
      bustedEl.classList.remove('hidden');
      audio.siren(false);
      audio.engine(false, 0);
      saveSave({ money: bank.money, job: missions.index, finished: [] });
    }

    // Missions (frozen in shot mode so the posed objective stays on screen).
    if (state === 'playing' && !shot) {
      const ctx = { player, vehicles, police, money: bank.money, toast: (t) => hud.toast(t), input };
      const result = missions.update(dt, ctx);
      bank.money = ctx.money;
      if (result) {
        audio.chime();
        saveSave({ money: bank.money, job: missions.index, finished: [] });
        if (result.allDone) {
          state = 'complete';
          document.getElementById('completeTitle').textContent = 'CORAL BAY LEGEND';
          document.getElementById('completeText').textContent =
            'All three jobs done. Dana Cruz owns this city now — $' + bank.money + ' in the pocket and the whole bay behind her.';
          completeEl.classList.remove('hidden');
          audio.siren(false);
        } else {
          document.getElementById('completeTitle').textContent = 'JOB DONE';
          document.getElementById('completeText').textContent =
            'Paid +$' + result.paid + '. Next up: ' + result.next;
          state = 'complete';
          completeEl.classList.remove('hidden');
        }
      }
    }

    // Health slowly comes back when the heat is off.
    if (police.wanted === 0 && player.health < 100) player.health = Math.min(100, player.health + 2 * dt);

    // Sound follows the world.
    if (player.inCar) audio.engine(true, Math.abs(player.inCar.speed) / 30);
    else audio.engine(false, 0);
    audio.siren(police.sirenOn && state === 'playing');

    // Camera and HUD.
    followCamera(dt);
    const marker = missions.marker.visible
      ? { x: missions.marker.position.x, z: missions.marker.position.z }
      : null;
    hud.update({
      money: bank.money,
      health: player.health,
      wanted: police.wanted,
      title: missions.titleText(),
      objective: missions.objectiveText(),
      inCar: !!player.inCar,
      speed: player.inCar ? player.inCar.speed : 0,
    });
    hud.drawMinimap({
      player: { x: player.pos.x, z: player.pos.z, heading: player.inCar ? player.inCar.heading : player.heading },
      traffic: vehicles.traffic.map((c) => ({ x: c.pos.x, z: c.pos.z })),
      police: police.cops.map((c) => ({ x: c.pos.x, z: c.pos.z })),
      marker,
    });

    if (shot && frames === 30) window.__shotReady = true;
  } else {
    // Menu / paused / busted / complete: keep the scene alive behind the overlay.
    vehicles.updateTraffic(dt, null);
    peds.update(dt, []);
    followCamera(dt);
    renderer.render(scene, camera);
    return;
  }

  renderer.render(scene, camera);
}

tick();
