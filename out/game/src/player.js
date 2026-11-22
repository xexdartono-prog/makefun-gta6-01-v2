// Dana Cruz on foot: a simple articulated figure (boxes for torso, head, limbs)
// with a walk-cycle swing, jump physics and a short punch. Movement is relative to
// the camera yaw; the camera itself lives in main.js.
import * as THREE from 'three';
import { resolveBuildingCollision } from './city.js';

const WALK_SPEED = 7;
const RUN_SPEED = 11;

function limbMat(color) {
  return new THREE.MeshLambertMaterial({ color });
}

export class Player {
  constructor(scene) {
    this.pos = new THREE.Vector3(0, 0, 116);
    this.heading = 0;       // radians, facing direction
    this.vy = 0;            // vertical velocity for jumps
    this.grounded = true;
    this.speed = 0;
    this.punchTimer = 0;
    this.punchCooldown = 0;
    this.walkPhase = 0;
    this.health = 100;
    this.inCar = null;      // Vehicle when driving, else null

    const g = new THREE.Group();
    g.name = 'dana';
    const skin = limbMat(0xc68e5e);
    const shirt = limbMat(0xef476f);
    const pants = limbMat(0x264653);
    const hair = limbMat(0x1d1a16);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.5), shirt);
    torso.position.y = 1.35;
    torso.castShadow = true;
    g.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), skin);
    head.position.y = 2.2;
    head.castShadow = true;
    g.add(head);
    const hairM = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, 0.6), hair);
    hairM.position.y = 2.5;
    g.add(hairM);
    this.armL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.95, 0.28), skin);
    this.armL.position.set(-0.62, 1.35, 0);
    g.add(this.armL);
    this.armR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.95, 0.28), skin);
    this.armR.position.set(0.62, 1.35, 0);
    g.add(this.armR);
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.85, 0.34), pants);
    this.legL.position.set(-0.24, 0.45, 0);
    g.add(this.legL);
    this.legR = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.85, 0.34), pants);
    this.legR.position.set(0.24, 0.45, 0);
    g.add(this.legR);

    this.group = g;
    this.group.position.copy(this.pos);
    scene.add(g);
  }

  // input: {f,b,l,r,jump,punch} booleans; camYaw: camera facing; dt seconds.
  // onPunchHit: called with (target) when a punch lands on something hittable.
  update(dt, input, camYaw, city, hittables, onPunchHit) {
    if (this.inCar) return; // driving is the vehicle's job
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);

    let mx = 0, mz = 0;
    if (input.f) { mx += -Math.sin(camYaw); mz += -Math.cos(camYaw); }
    if (input.b) { mx += Math.sin(camYaw); mz += Math.cos(camYaw); }
    if (input.l) { mx += -Math.cos(camYaw); mz += Math.sin(camYaw); }
    if (input.r) { mx += Math.cos(camYaw); mz += -Math.sin(camYaw); }
    const len = Math.hypot(mx, mz);
    const sprint = input.sprint ? RUN_SPEED : WALK_SPEED;
    if (len > 0.01) {
      mx /= len; mz /= len;
      this.speed = sprint;
      this.pos.x += mx * sprint * dt;
      this.pos.z += mz * sprint * dt;
      this.heading = Math.atan2(mx, mz);
      this.walkPhase += dt * sprint * 1.6;
    } else {
      this.speed = 0;
    }

    // Jump + gravity.
    if (input.jump && this.grounded) {
      this.vy = 7.5;
      this.grounded = false;
    }
    if (!this.grounded) {
      this.vy -= 22 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= 0) { this.pos.y = 0; this.vy = 0; this.grounded = true; }
    }

    // Buildings block walking.
    const fixed = resolveBuildingCollision(city, this.pos.x, this.pos.z, 0.7);
    this.pos.x = fixed.x;
    this.pos.z = fixed.z;

    // Punch: a short forward arc; hits the first hittable in range.
    if (input.punch && this.punchCooldown <= 0) {
      this.punchTimer = 0.22;
      this.punchCooldown = 0.45;
      const fx = Math.sin(this.heading);
      const fz = Math.cos(this.heading);
      for (const t of hittables) {
        const dx = t.pos.x - this.pos.x;
        const dz = t.pos.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 2.2 && (dx * fx + dz * fz) / Math.max(d, 0.001) > 0.35) {
          if (onPunchHit) onPunchHit(t);
          break;
        }
      }
    }
    this.punchTimer = Math.max(0, this.punchTimer - dt);

    // Pose: limbs swing with the walk phase; right arm snaps forward on a punch.
    const swing = this.speed > 0 ? Math.sin(this.walkPhase) * 0.55 : 0;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing;
    if (this.punchTimer > 0) {
      this.armR.rotation.x = -1.5;
    } else {
      this.armR.rotation.x = swing;
    }

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
    this.group.visible = !this.inCar;
  }

  teleport(x, z, heading = 0) {
    this.pos.set(x, 0, z);
    this.heading = heading;
    this.vy = 0;
    this.grounded = true;
    this.group.position.copy(this.pos);
    this.group.rotation.y = heading;
  }
}
