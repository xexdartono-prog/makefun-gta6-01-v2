// The story: three jobs for Dana Cruz across Coral Bay, played in order.
// Each job is a short chain of steps. Every step has a place — a glowing
// beacon in the world, a pulsing dot on the minimap and a line on the HUD —
// and a test for when it is done. Finishing a job pays cash, saves, and
// unlocks the next one.
import * as THREE from 'three';

function makeBeacon(color = 0xffd166) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 26, 16, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  shaft.position.y = 13;
  g.add(shaft);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.6, 2.4, 24),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.3;
  g.add(ring);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.9), new THREE.MeshBasicMaterial({ color }));
  gem.position.y = 5;
  g.add(gem);
  g.userData.gem = gem;
  return g;
}

export const JOBS = [
  {
    id: 0,
    title: 'JOB 1 — FIRST FARE',
    reward: 150,
    intro: 'A client needs a driver, not a walker. Steal a car and bring it to the drop-off.',
    steps: [
      { text: 'Walk to the marked car and press E to take it', kind: 'car' },
      { text: 'Drive the car to the green drop-off', kind: 'goto', place: 'downtown' },
    ],
  },
  {
    id: 1,
    title: 'JOB 2 — HARBOR RUN',
    reward: 300,
    intro: 'A package is waiting on the marina docks. The police are watching the harbour — expect heat.',
    steps: [
      { text: 'Pick up the package at the marina docks', kind: 'goto', place: 'marina' },
      { text: 'Deliver the package downtown — the heat is on', kind: 'goto', place: 'downtown', wanted: 2 },
    ],
  },
  {
    id: 2,
    title: 'JOB 3 — BAY HEIST',
    reward: 500,
    intro: 'The jewellery store on the bay keeps its gold behind one thin door. Crack it, grab it, run.',
    steps: [
      { text: 'Reach the jewellery store on the north-east block', kind: 'goto', place: 'jewelry' },
      { text: 'Hold F by the door to crack it open', kind: 'crack', place: 'jewelry', seconds: 3 },
      { text: 'Grab the gold, then escape to the beach — wanted level 4!', kind: 'goto', place: 'beach', wanted: 4, loot: 800 },
    ],
  },
];

export class Missions {
  constructor(scene, landmarks) {
    this.scene = scene;
    this.landmarks = landmarks;
    this.index = 0;   // which job is active
    this.step = 0;    // which step inside it
    this.done = false;
    this.marker = makeBeacon(0xffd166);
    this.scene.add(this.marker);
    this.crackProgress = 0;
    this.lootTaken = false;
    this.placeMarker(this.currentPlace());
  }

  get job() { return JOBS[this.index]; }

  currentPlace() {
    if (this.done) return null;
    const step = this.job.steps[this.step];
    if (step.kind === 'car') return null; // beacon rides the mission car instead
    return this.landmarks[step.place];
  }

  placeMarker(place) {
    if (!place) {
      this.marker.visible = false;
      return;
    }
    this.marker.visible = true;
    this.marker.position.set(place.x, 0, place.z);
  }

  // While the job says "steal a car", the beacon hovers over that car.
  followCar(car) {
    if (!car) return;
    this.marker.visible = true;
    this.marker.position.set(car.pos.x, 0, car.pos.z);
  }

  // ctx: {player, vehicles, police, money, toast, input}.
  // Returns {paid, allDone, next} when a job ends, else null.
  update(dt, ctx) {
    if (this.done) return null;
    this.marker.userData.gem.rotation.y += dt * 2;
    this.marker.userData.gem.position.y = 5 + Math.sin(performance.now() / 300) * 0.5;

    const step = this.job.steps[this.step];
    const place = this.currentPlace();
    if (place) this.placeMarker(place);

    const target = ctx.player.inCar ? ctx.player.inCar.pos : ctx.player.pos;
    const reached = (p, r = 5) => Math.hypot(target.x - p.x, target.z - p.z) < r;

    if (step.kind === 'car') {
      this.followCar(ctx.vehicles.missionCar);
      if (ctx.player.inCar === ctx.vehicles.missionCar) {
        return this.advance(ctx, 'Nice wheels. Now drive it downtown.');
      }
      return null;
    }
    if (step.kind === 'goto') {
      if (step.wanted && ctx.police.wanted < step.wanted) ctx.police.setWanted(step.wanted);
      if (step.loot && !this.lootTaken) {
        this.lootTaken = true;
        ctx.money += step.loot;
        ctx.toast('+$' + step.loot + ' GOLD GRABBED — RUN!');
      }
      if (reached(place, 6)) return this.advance(ctx);
      return null;
    }
    if (step.kind === 'crack') {
      if (reached(place, 5) && ctx.input.punch) {
        this.crackProgress += dt;
        if (this.crackProgress >= step.seconds) {
          this.crackProgress = 0;
          return this.advance(ctx, 'Door’s open — grab the gold and run!');
        }
      } else {
        this.crackProgress = Math.max(0, this.crackProgress - dt * 0.5);
      }
      return null;
    }
    return null;
  }

  advance(ctx, msg) {
    this.step += 1;
    this.lootTaken = false;
    this.crackProgress = 0;
    if (msg) ctx.toast(msg);
    if (this.step >= this.job.steps.length) {
      const reward = this.job.reward;
      ctx.money += reward;
      ctx.toast('JOB DONE! +$' + reward);
      this.index += 1;
      this.step = 0;
      if (this.index >= JOBS.length) {
        this.done = true;
        this.marker.visible = false;
        return { paid: reward, allDone: true };
      }
      this.placeMarker(this.currentPlace());
      return { paid: reward, allDone: false, next: JOBS[this.index].title };
    }
    this.placeMarker(this.currentPlace());
    return null;
  }

  objectiveText() {
    if (this.done) return 'All jobs done — Coral Bay is yours, Dana.';
    return this.job.steps[this.step].text;
  }

  titleText() {
    if (this.done) return 'CORAL BAY — LEGEND';
    return this.job.title;
  }

  startJob(i) {
    this.index = i;
    this.step = 0;
    this.done = false;
    this.lootTaken = false;
    this.crackProgress = 0;
    this.placeMarker(this.currentPlace());
  }
}
