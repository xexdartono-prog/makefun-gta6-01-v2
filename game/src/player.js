// Dana Cruz on foot: a boxy articulated figure with a walk cycle, a jump and
// a short punch. She moves relative to the camera, so W always runs away from
// the lens. Driving is the vehicle's job; this file only handles the body.
import * as THREE from 'three';
import { resolveBuildingCollision } from './city.js';

const WALK = 7;
const SPRINT = 11;

function cloth(color) {
  return new THREE.MeshLambertMaterial({ color });
}

export class Player {
  constructor(scene) {
    this.pos = new THREE.Vector3(0, 0, 116);
    this.heading = 0;
    this.vy = 0;
    this.grounded = true;
    this.speed = 0;
    this.punchTimer = 0;
    this.punchCooldown = 0;
    this.walkPhase = 0;
    this.health = 100;
    this.inCar = null;

    const skin = cloth(0xc68e5e);
    const top = cloth(0xef476f);
    const jeans = cloth(0x264653);
    const hair = cloth(0x1d1a16);

    const body = new THREE.Group();
    body.name = 'dana';

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.5), top);
    torso.position.y = 1.35;
    torso.castShadow = true;
    body.add(torso);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), skin);
    head.position.y = 2.2;
    head.castShadow = true;
    body.add(head);

    const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, 0.6), hair);
    fringe.position.y = 2.5;
    body.add(fringe);

    this.armL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.95, 0.28), skin);
    this.armL.position.set(-0.62, 1.35, 0);
    body.add(this.armL);
    this.armR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.95, 0.28), skin);
    this.armR.position.set(0.62, 1.35, 0);
    body.add(this.armR);

    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.85, 0.34), jeans);
    this.legL.position.set(-0.24, 0.45, 0);
    body.add(this.legL);
    this.legR = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.85, 0.34), jeans);
    this.legR.position.set(0.24, 0.45, 0);
    body.add(this.legR);

    this.group = body;
    this.group.position.copy(this.pos);
    scene.add(body);
  }

  // input: {f,b,l,r,jump,punch,sprint}; camYaw: where the camera looks.
  // hittables: things a punch can land on; onPunchHit(target) fires on a hit.
  update(dt, input, camYaw, city, hittables, onPunchHit) {
    if (this.inCar) return;
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);

    // Camera-relative movement: forward is away from the camera.
    let mx = 0;
    let mz = 0;
    if (input.f) { mx += -Math.sin(camYaw); mz += -Math.cos(camYaw); }
    if (input.b) { mx += Math.sin(camYaw); mz += Math.cos(camYaw); }
    if (input.l) { mx += -Math.cos(camYaw); mz += Math.sin(camYaw); }
    if (input.r) { mx += Math.cos(camYaw); mz += -Math.sin(camYaw); }
    const len = Math.hypot(mx, mz);
    const pace = input.sprint ? SPRINT : WALK;
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      this.speed = pace;
      this.pos.x += mx * pace * dt;
      this.pos.z += mz * pace * dt;
      this.heading = Math.atan2(mx, mz);
      this.walkPhase += dt * pace * 1.6;
    } else {
      this.speed = 0;
    }

    // Jump and gravity.
    if (input.jump && this.grounded) {
      this.vy = 7.5;
      this.grounded = false;
    }
    if (!this.grounded) {
      this.vy -= 22 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= 0) {
        this.pos.y = 0;
        this.vy = 0;
        this.grounded = true;
      }
    }

    // Walls stop her.
    const fixed = resolveBuildingCollision(city, this.pos.x, this.pos.z, 0.7);
    this.pos.x = fixed.x;
    this.pos.z = fixed.z;

    // Punch: a forward arc, first hittable inside it goes down.
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

    // Walk-cycle pose; the right arm snaps forward while punching.
    const swing = this.speed > 0 ? Math.sin(this.walkPhase) * 0.55 : 0;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing;
    this.armR.rotation.x = this.punchTimer > 0 ? -1.5 : swing;

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
