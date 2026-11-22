// Pedestrians: Coral Bay locals strolling the sidewalks. They walk between random
// sidewalk points, and they run when a car barrels at them or when Dana throws a
// punch nearby. A punched local drops to the ground for a few seconds — and
// sometimes drops a little cash.
import * as THREE from 'three';
import { blockCenter, BLOCK } from './city.js';

const SHIRTS = [0xf4f1de, 0x8ecae6, 0xffd166, 0x90be6d, 0xf28482, 0x84a59d, 0xe07a5f, 0x81b29a];

export class Pedestrians {
  constructor(scene, city, rand) {
    this.scene = scene;
    this.city = city;
    this.rand = rand;
    this.list = [];
  }

  spawn(n) {
    for (let i = 0; i < n; i++) {
      const bx = Math.floor(this.rand() * 8);
      const bz = Math.floor(this.rand() * 8);
      const x = blockCenter(bx) + (this.rand() - 0.5) * (BLOCK - 6);
      const z = blockCenter(bz) + (this.rand() - 0.5) * (BLOCK - 6);
      this.list.push(this.makePed(x, z));
    }
  }

  makePed(x, z) {
    const g = new THREE.Group();
    const shirt = SHIRTS[Math.floor(this.rand() * SHIRTS.length)];
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.0, 0.45),
      new THREE.MeshLambertMaterial({ color: shirt }),
    );
    torso.position.y = 1.3;
    torso.castShadow = true;
    g.add(torso);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xc68e5e }),
    );
    head.position.y = 2.1;
    g.add(head);
    const legL = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.85, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x264653 }),
    );
    legL.position.set(-0.2, 0.42, 0);
    g.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.2;
    g.add(legR);
    g.position.set(x, 0, z);
    this.scene.add(g);
    return {
      group: g, pos: g.position, heading: this.rand() * Math.PI * 2,
      speed: 1.4 + this.rand() * 1.2, state: 'walk', timer: 0,
      target: new THREE.Vector3(x, 0, z), fallen: false, fallTimer: 0,
      legL, legR, phase: this.rand() * 6,
    };
  }

  fall(ped) {
    if (ped.fallen) return;
    ped.fallen = true;
    ped.fallTimer = 4;
    ped.group.rotation.z = Math.PI / 2;
    ped.group.position.y = 0.4;
  }

  update(dt, threats) {
    // threats: [{x, z, radius, kind: 'punch'|'car'}] — peds near one start running.
    for (const p of this.list) {
      if (p.fallen) {
        p.fallTimer -= dt;
        if (p.fallTimer <= 0) {
          p.fallen = false;
          p.group.rotation.z = 0;
          p.group.position.y = 0;
          p.state = 'walk';
        }
        continue;
      }
      let fleeing = false;
      for (const t of threats) {
        const d = Math.hypot(p.pos.x - t.x, p.pos.z - t.z);
        if (d < t.radius) {
          fleeing = true;
          p.state = 'flee';
          p.timer = 2.5;
          p.fleeFrom = { x: t.x, z: t.z };
          break;
        }
      }
      if (p.state === 'flee') {
        p.timer -= dt;
        const dx = p.pos.x - p.fleeFrom.x;
        const dz = p.pos.z - p.fleeFrom.z;
        const d = Math.hypot(dx, dz) || 1;
        p.heading = Math.atan2(dx / d, dz / d);
        p.pos.x += (dx / d) * 8 * dt;
        p.pos.z += (dz / d) * 8 * dt;
        p.phase += dt * 14;
        if (p.timer <= 0) p.state = 'walk';
      } else {
        const dx = p.target.x - p.pos.x;
        const dz = p.target.z - p.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 1) {
          const bx = Math.floor(this.rand() * 8);
          const bz = Math.floor(this.rand() * 8);
          p.target.set(
            blockCenter(bx) + (this.rand() - 0.5) * (BLOCK - 6),
            0,
            blockCenter(bz) + (this.rand() - 0.5) * (BLOCK - 6),
          );
        } else {
          p.heading = Math.atan2(dx / d, dz / d);
          p.pos.x += (dx / d) * p.speed * dt;
          p.pos.z += (dz / d) * p.speed * dt;
          p.phase += dt * p.speed * 3;
        }
      }
      p.legL.rotation.x = Math.sin(p.phase) * 0.5;
      p.legR.rotation.x = -Math.sin(p.phase) * 0.5;
      p.group.rotation.y = p.heading;
    }
  }
}
