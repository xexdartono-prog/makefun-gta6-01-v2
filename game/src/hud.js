// HUD: the DOM panels (cash, health, wanted stars, objective, speed) and the
// 2D minimap drawn top-down — roads, beach and marina, the player arrow,
// police as red dots, traffic as grey dots and the mission marker pulsing gold.
import { HALF, roadCenter } from './city.js';

export class HUD {
  constructor() {
    this.moneyEl = document.getElementById('money');
    this.healthEl = document.getElementById('healthBar');
    this.starsEl = document.getElementById('stars');
    this.titleEl = document.getElementById('missionTitle');
    this.objectiveEl = document.getElementById('objectiveText');
    this.speedEl = document.getElementById('speed');
    this.toastEl = document.getElementById('toast');
    this.map = document.getElementById('minimap');
    this.mctx = this.map.getContext('2d');
    this.toastTimer = null;
    this.lastMoney = -1;
    this.lastWanted = -1;
    this.lastHealth = -1;
  }

  toast(text) {
    this.toastEl.textContent = text;
    this.toastEl.style.opacity = '1';
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toastEl.style.opacity = '0'; }, 2600);
  }

  update(state) {
    if (state.money !== this.lastMoney) {
      this.moneyEl.textContent = '$' + state.money.toLocaleString('en-US');
      this.lastMoney = state.money;
    }
    const hp = Math.max(0, Math.round(state.health));
    if (hp !== this.lastHealth) {
      this.healthEl.style.width = hp + '%';
      this.lastHealth = hp;
    }
    if (state.wanted !== this.lastWanted) {
      let stars = '';
      for (let i = 0; i < 5; i++) {
        stars += i < state.wanted ? '★' : '<span class="dim">★</span>';
      }
      this.starsEl.innerHTML = stars;
      this.lastWanted = state.wanted;
    }
    this.titleEl.textContent = state.title;
    this.objectiveEl.textContent = state.objective;
    this.speedEl.textContent = state.inCar
      ? `SPEED ${Math.round(Math.abs(state.speed) * 3.6)} km/h — E to step out`
      : 'On foot — E near a car to drive';
  }

  drawMinimap(state) {
    const g = this.mctx;
    const S = this.map.width;
    const span = HALF * 2 + 130;
    const toMap = (x, z) => [((x + span / 2) / span) * S, ((z + span / 2) / span) * S];
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#16242e';
    g.fillRect(0, 0, S, S);
    // Water: the sea to the south, the marina to the east.
    g.fillStyle = '#1f7a6d';
    const [, seaTop] = toMap(0, HALF + 40);
    g.fillRect(0, seaTop, S, S - seaTop);
    const [harbourLeft] = toMap(HALF + 10, 0);
    g.fillRect(harbourLeft, 0, S - harbourLeft, S);
    // Sand beach.
    g.fillStyle = '#cbb878';
    const [, beachTop] = toMap(-HALF, HALF);
    g.fillRect(0, beachTop, S, S - beachTop);
    // Roads.
    g.strokeStyle = '#5a636b';
    g.lineWidth = 4;
    for (let i = 0; i <= 8; i++) {
      const [rx] = toMap(roadCenter(i), 0);
      g.beginPath(); g.moveTo(rx, 0); g.lineTo(rx, S); g.stroke();
      const [, rz] = toMap(0, roadCenter(i));
      g.beginPath(); g.moveTo(0, rz); g.lineTo(S, rz); g.stroke();
    }
    // Mission marker, pulsing gold.
    if (state.marker) {
      const [mx, my] = toMap(state.marker.x, state.marker.z);
      const pulse = 5 + Math.sin(performance.now() / 250) * 2;
      g.fillStyle = '#ffd166';
      g.beginPath(); g.arc(mx, my, pulse, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#08222e';
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(mx, my, pulse, 0, Math.PI * 2); g.stroke();
    }
    // Traffic grey, police red.
    for (const t of state.traffic) {
      const [tx, ty] = toMap(t.x, t.z);
      g.fillStyle = '#9aa5ad';
      g.fillRect(tx - 1.5, ty - 1.5, 3, 3);
    }
    for (const p of state.police) {
      const [px, py] = toMap(p.x, p.z);
      g.fillStyle = '#ef476f';
      g.beginPath(); g.arc(px, py, 3.5, 0, Math.PI * 2); g.fill();
    }
    // Player arrow (gold). A heading of h means forward (sin h, cos h), so the
    // arrow on a map where +y is down points at angle PI - h.
    const [px, py] = toMap(state.player.x, state.player.z);
    g.save();
    g.translate(px, py);
    g.rotate(Math.PI - state.player.heading);
    g.fillStyle = '#ffd166';
    g.beginPath();
    g.moveTo(0, -7);
    g.lineTo(5, 5);
    g.lineTo(-5, 5);
    g.closePath();
    g.fill();
    g.restore();
  }
}
