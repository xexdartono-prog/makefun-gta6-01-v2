// Procedural sound, no audio files: every effect is an oscillator or filtered
// noise built with the Web Audio API. Everything starts on the first user gesture
// (the Start button), so the browser's autoplay rules are never in the way.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
    this.ambientStarted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.startAmbient();
  }

  startAmbient() {
    if (this.ambientStarted || !this.ctx) return;
    this.ambientStarted = true;
    // A slow, warm pad: two detuned triangle waves under a slow tremolo.
    const padGain = this.ctx.createGain();
    padGain.gain.value = 0.05;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(padGain.gain);
    lfo.start();
    for (const freq of [110, 164.8, 220]) {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      o.detune.value = (Math.random() - 0.5) * 6;
      o.connect(padGain);
      o.start();
    }
    padGain.connect(this.master);
  }

  // Continuous engine hum whose pitch follows the car's speed (0..1).
  engine(on, speed01) {
    if (!this.ctx) return;
    if (on && !this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 70;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.06;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    if (this.engineOsc) {
      this.engineOsc.frequency.value = 60 + speed01 * 190;
      this.engineGain.gain.value = on ? 0.05 + speed01 * 0.06 : 0;
      if (!on) {
        const osc = this.engineOsc;
        const gain = this.engineGain;
        this.engineOsc = null;
        this.engineGain = null;
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.15);
        setTimeout(() => { try { osc.stop(); } catch (_) { /* already stopped */ } }, 200);
      }
    }
  }

  siren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 750;
      this.sirenLfo = this.ctx.createOscillator();
      this.sirenLfo.type = 'square';
      this.sirenLfo.frequency.value = 0.9;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 260;
      this.sirenLfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.035;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.sirenLfo.start();
    } else if (!on && this.sirenOsc) {
      const o = this.sirenOsc, l = this.sirenLfo, g = this.sirenGain;
      this.sirenOsc = null; this.sirenLfo = null; this.sirenGain = null;
      g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);
      setTimeout(() => { try { o.stop(); l.stop(); } catch (_) { /* already stopped */ } }, 250);
    }
  }

  blip(freq, dur, type = 'sine', vol = 0.18) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g);
    g.connect(this.master);
    o.start();
    o.stop(this.ctx.currentTime + dur);
  }

  punch() {
    if (!this.ctx) return;
    const len = this.ctx.sampleRate * 0.12;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    const g = this.ctx.createGain();
    g.gain.value = 0.5;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start();
  }

  chime() {
    this.blip(660, 0.25, 'sine', 0.2);
    setTimeout(() => this.blip(880, 0.35, 'sine', 0.2), 110);
  }

  crash() {
    this.blip(90, 0.3, 'square', 0.22);
    this.punch();
  }
}
