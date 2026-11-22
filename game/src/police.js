// Wanted system: a 0-5 star level. Crimes raise it; police cars spawn at the city
// edge and chase the player, ramming the player's car or cornering Dana on foot.
// Stay quiet and out of sight and the heat slowly cools off.
import * as THREE from 'three';
import { Vehicle } from './vehicles.js';
import { HALF } from './city.js';

export class Police {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.wanted = 0;
    this.cops = [];
    this.quietTimer = 0;   // seconds since the last crime
    this.coolTimer = 0;    // counts down to losing a star
    this.spawnTimer = 0;
    this.sirenOn = false;
  }

  addWanted(n) {
    this.wanted = Math.max(0, Math.min(5, this.wanted + n));
    this.quietTimer = 0;
    this.coolTimer = 12;
    if (this.wanted > 0) this.sirenOn = true;
  }

  setWanted(n) {
    this.wanted = Math.max(0, Math.min(5, n));
    this.quietTimer = 0;
    this.coolTimer = 12;
    this.sirenOn = this.wanted > 0;
  }

  // Keep the number of cop cars equal to the wanted level (up to 5).
  syncCopCount() {
    while (this.cops.length < this.wanted) {
      const edge = Math.floor(Math.random() * 4);
      let x = 0, z = 0;
      if (edge === 0) { x = -HALF - 4; z = (Math.random() * 2 - 1) * HALF; }
      if (edge === 1) { x = HALF + 4; z = (Math.random() * 2 - 1) * HALF; }
      if (edge === 2) { x = (Math.random() * 2 - 1) * HALF; z = -HALF - 4; }
      if (edge === 3) { x = (Math.random() * 2 - 1) * HALF; z = HALF + 20; }
      const cop = new Vehicle(this.scene, x, z, 0, 0x1b263b, { police: true });
      cop.cruise = 0;
      this.cops.push(cop);
    }
    while (this.cops.length > this.wanted) {
      const cop = this.cops.pop();
      this.scene.remove(cop.group);
    }
  }

  // dt seconds. target: {pos, inCar, speed}. Returns 'busted' when a cop
  // corners Dana on foot, 'ram' with a strength when a cop hits the player's car.
  update(dt, target, vehicles, onRam) {
    this.quietTimer += dt;
    if (this.wanted > 0 && this.quietTimer > 20) {
      this.coolTimer -= dt;
      if (this.coolTimer <= 0) {
        this.wanted -= 1;
        this.coolTimer = 12;
        this.quietTimer = 0;
        if (this.wanted === 0) this.sirenOn = false;
      }
    }
    this.syncCopCount();

    for (const cop of this.cops) {
      const dx = target.pos.x - cop.pos.x;
      const dz = target.pos.z - cop.pos.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let diff = wantHeading - cop.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cop.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      // Cops are fast but not unfair: slightly slower than a full-speed getaway car.
      const targetSpeed = this.wanted >= 4 ? 27 : 23;
      cop.speed += (targetSpeed - cop.speed) * Math.min(1, dt * 1.4);
      const f = cop.forward();
      cop.pos.x += f.x * cop.speed * dt;
      cop.pos.z += f.z * cop.speed * dt;
      cop.sync();

      if (dist < 3.4) {
        if (target.inCar) {
          if (onRam) onRam(cop.speed);
          // The ram shoves the player's car sideways.
          cop.speed *= 0.4;
          if (vehicles.playerCar) {
            vehicles.playerCar.pos.x += f.x * 1.6;
            vehicles.playerCar.pos.z += f.z * 1.6;
          }
        } else if (target.speed < 2.5) {
          return 'busted';
        }
      }
    }
    return null;
  }

  clear() {
    for (const cop of this.cops) this.scene.remove(cop.group);
    this.cops = [];
    this.wanted = 0;
    this.sirenOn = false;
  }
}
