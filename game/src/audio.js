// Sound, all procedural WebAudio — no audio files. An engine hum that
// follows speed, a two-tone siren while wanted, blips and thuds.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenHigh = false;
    this.sirenTimer = 0;
    this.ready = false;
  }

  // Called from the first user gesture (the Start button), as browsers
  // require sound to start from an interaction.
  unlock() {
    if (this.ready) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 60;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();

      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.ctx.destination);
      this.sirenOsc.start();
      this.ready = true;
    } catch (e) {
      this.ready = false;
    }
  }

  update(world, dt) {
    if (!this.ready) return;
    const speed = world.player.car ? Math.abs(world.player.car.speed) : world.player.walkSpeed;
    const target = world.player.car ? 0.03 + (speed / 26) * 0.05 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speed * 7, this.ctx.currentTime, 0.1);
    if (world.wanted > 0) {
      this.sirenGain.gain.setTargetAtTime(0.035, this.ctx.currentTime, 0.2);
      this.sirenTimer += dt;
      if (this.sirenTimer > 0.42) {
        this.sirenTimer = 0;
        this.sirenHigh = !this.sirenHigh;
        this.sirenOsc.frequency.setTargetAtTime(this.sirenHigh ? 920 : 700, this.ctx.currentTime, 0.05);
      }
    } else {
      this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    }
  }

  blip(freq = 880) {
    if (!this.ready) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.12, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start();
    o.stop(this.ctx.currentTime + 0.2);
  }

  sirenBlip() {
    this.blip(920);
    setTimeout(() => this.blip(700), 160);
  }

  thud() {
    if (!this.ready) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, this.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 0.18);
    g.gain.setValueAtTime(0.25, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start();
    o.stop(this.ctx.currentTime + 0.22);
  }
}
