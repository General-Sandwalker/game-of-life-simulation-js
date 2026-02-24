/**
 * renderer.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Canvas renderer for the blob population.
 *
 * Visual features:
 *  • Each blob is a soft organic circle with a colour matching its strategy.
 *  • Radius is proportional to the blob's score.
 *  • A pulsing glow appears on blobs that just reproduced or were born.
 *  • Blobs move slightly each frame (soft random walk within bounds).
 *  • Hovering the canvas shows a tooltip with blob details.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { STRATEGY_MAP } from './strategies.js';

const MIN_RADIUS  = 4;
const MAX_RADIUS  = 18;
const DAMPING     = 0.95;
const SPEED_BASE  = 0.0004;

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLElement}       tooltipEl
   */
  constructor(canvas, tooltipEl) {
    this.canvas   = canvas;
    this.ctx      = canvas.getContext('2d');
    this.tooltip  = tooltipEl;
    this.blobs    = [];
    this.newborns = new Set();   // blob ids born this generation (for glow)
    this._rafId   = null;
    this._running = false;
    this._hoveredBlob = null;

    // Resize observer
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(canvas.parentElement);
    this._resize();

    // Mouse events
    canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    canvas.addEventListener('mouseleave', () => {
      this._hoveredBlob = null;
      if (this.tooltip) this.tooltip.style.display = 'none';
    });
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /** Update the blob list and mark new births for glow effect. */
  update(blobs, births = []) {
    this.blobs = blobs;
    this.newborns = new Set(births.map(b => b.id));
    // Decay glow
    for (const blob of this.blobs) {
      if (this.newborns.has(blob.id)) {
        blob.glowIntensity = 1.0;
      } else {
        blob.glowIntensity = Math.max(0, blob.glowIntensity - 0.02);
      }
    }
  }

  /** Start the render loop. */
  start() {
    if (this._running) return;
    this._running = true;
    this._frame();
  }

  /** Stop the render loop. */
  stop() {
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = null;
  }

  // ─── Resize ─────────────────────────────────────────────────────────────────

  _resize() {
    const parent = this.canvas.parentElement;
    this.canvas.width  = parent.clientWidth;
    this.canvas.height = parent.clientHeight;
  }

  // ─── Animation frame ─────────────────────────────────────────────────────────

  _frame() {
    if (!this._running) return;
    this._tick();
    this._draw();
    this._rafId = requestAnimationFrame(() => this._frame());
  }

  // ─── Physics tick ────────────────────────────────────────────────────────────

  _tick() {
    const W = this.canvas.width;
    const H = this.canvas.height;

    for (const blob of this.blobs) {
      // Light random walk
      blob.vx += (Math.random() - 0.5) * SPEED_BASE;
      blob.vy += (Math.random() - 0.5) * SPEED_BASE;
      blob.vx *= DAMPING;
      blob.vy *= DAMPING;

      blob.x += blob.vx;
      blob.y += blob.vy;

      // Boundary bounce (normalised coords)
      const pad = 0.02;
      if (blob.x < pad)      { blob.x = pad;      blob.vx =  Math.abs(blob.vx); }
      if (blob.x > 1 - pad)  { blob.x = 1 - pad;  blob.vx = -Math.abs(blob.vx); }
      if (blob.y < pad)      { blob.y = pad;      blob.vy =  Math.abs(blob.vy); }
      if (blob.y > 1 - pad)  { blob.y = 1 - pad;  blob.vy = -Math.abs(blob.vy); }

      // Compute display radius from score (clamped)
      const scoreNorm = Math.min(blob.score / 10, 1);
      blob.displayRadius = MIN_RADIUS + scoreNorm * (MAX_RADIUS - MIN_RADIUS);
    }
  }

  // ─── Draw ────────────────────────────────────────────────────────────────────

  _draw() {
    const ctx = this.ctx;
    const W   = this.canvas.width;
    const H   = this.canvas.height;

    // Background
    ctx.clearRect(0, 0, W, H);

    // Grid pattern (subtle)
    ctx.save();
    ctx.strokeStyle = 'rgba(46,74,46,0.12)';
    ctx.lineWidth   = 1;
    const gridSize  = 60;
    for (let x = 0; x < W; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();

    if (this.blobs.length === 0) {
      this._drawEmpty(ctx, W, H);
      return;
    }

    // Draw blobs (sort by radius so small blobs are on top)
    const sorted = [...this.blobs].sort((a, b) => b.displayRadius - a.displayRadius);
    const t = performance.now() / 1000;

    for (const blob of sorted) {
      this._drawBlob(ctx, blob, W, H, t);
    }

    // Hovered blob outline
    if (this._hoveredBlob) {
      this._drawHoverOutline(ctx, this._hoveredBlob, W, H);
    }
  }

  _drawBlob(ctx, blob, W, H, t) {
    const cx = blob.x * W;
    const cy = blob.y * H;
    const r  = blob.displayRadius;
    const color = STRATEGY_MAP[blob.strategyId]?.color || '#aaa';

    const pulse = 1 + Math.sin(blob.pulsePhase + t * 1.5) * 0.04;
    const pr    = r * pulse;

    // Glow
    if (blob.glowIntensity > 0) {
      const glowR = pr + 8 * blob.glowIntensity;
      const grd   = ctx.createRadialGradient(cx, cy, pr * 0.5, cx, cy, glowR);
      grd.addColorStop(0, color + Math.round(blob.glowIntensity * 80).toString(16).padStart(2,'0'));
      grd.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
    }

    // Body gradient
    const bodyGrd = ctx.createRadialGradient(cx - pr * 0.25, cy - pr * 0.25, pr * 0.05, cx, cy, pr);
    bodyGrd.addColorStop(0, lighten(color, 0.4));
    bodyGrd.addColorStop(0.6, color);
    bodyGrd.addColorStop(1, darken(color, 0.35));
    ctx.beginPath();
    ctx.arc(cx, cy, pr, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrd;
    ctx.fill();

    // Border
    ctx.strokeStyle = lighten(color, 0.2);
    ctx.lineWidth   = 1.2;
    ctx.stroke();

    // Score label (only if radius large enough)
    if (pr > 9) {
      ctx.fillStyle   = 'rgba(255,255,255,0.85)';
      ctx.font        = `bold ${Math.round(pr * 0.55)}px monospace`;
      ctx.textAlign   = 'center';
      ctx.textBaseline= 'middle';
      ctx.fillText(parseFloat(blob.score).toFixed(1), cx, cy);
    }

    // Strategy short code dot (top-right)
    ctx.beginPath();
    ctx.arc(cx + pr * 0.65, cy - pr * 0.65, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();
  }

  _drawHoverOutline(ctx, blob, W, H) {
    const cx = blob.x * W;
    const cy = blob.y * H;
    const r  = blob.displayRadius + 4;
    const color = STRATEGY_MAP[blob.strategyId]?.color || '#aaa';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2.5;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  _drawEmpty(ctx, W, H) {
    ctx.fillStyle   = 'rgba(138,171,106,0.25)';
    ctx.font        = '18px sans-serif';
    ctx.textAlign   = 'center';
    ctx.textBaseline= 'middle';
    ctx.fillText('Population Extinct 💀', W / 2, H / 2);
  }

  // ─── Mouse Interaction ───────────────────────────────────────────────────────

  _onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const my   = e.clientY - rect.top;
    const W    = this.canvas.width;
    const H    = this.canvas.height;

    let closest = null;
    let minDist = Infinity;

    for (const blob of this.blobs) {
      const cx = blob.x * W;
      const cy = blob.y * H;
      const d  = Math.hypot(mx - cx, my - cy);
      if (d < blob.displayRadius + 6 && d < minDist) {
        minDist  = d;
        closest  = blob;
      }
    }

    this._hoveredBlob = closest;

    if (closest && this.tooltip) {
      const d = closest.toDisplay();
      this.tooltip.style.display = 'block';
      this.tooltip.style.left    = `${e.clientX + 14}px`;
      this.tooltip.style.top     = `${e.clientY - 10}px`;
      this.tooltip.innerHTML = `
        <div class="tt-name">🫧 #${d.id} — ${d.strategy}</div>
        <div class="tt-row"><span class="tt-key">Score</span><span class="tt-val">${d.score}</span></div>
        <div class="tt-row"><span class="tt-key">Age</span><span class="tt-val">${d.age} gen</span></div>
        <div class="tt-row"><span class="tt-key">W/L/D</span><span class="tt-val">${d.wins}/${d.losses}/${d.draws}</span></div>
        <div class="tt-row"><span class="tt-key">Coop%</span><span class="tt-val">${d.coopRate}%</span></div>
        ${d.mutated ? '<div class="tt-row"><span class="tt-key" style="color:#f59e0b">⚡ Mutant</span></div>' : ''}
      `;
    } else if (this.tooltip) {
      this.tooltip.style.display = 'none';
    }
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────────

  destroy() {
    this.stop();
    this._ro.disconnect();
  }
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#',''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lighten(hex, amount) {
  const [r,g,b] = hexToRgb(hex);
  return `rgb(${Math.min(255,r+Math.round(amount*255))},${Math.min(255,g+Math.round(amount*255))},${Math.min(255,b+Math.round(amount*255))})`;
}

function darken(hex, amount) {
  const [r,g,b] = hexToRgb(hex);
  return `rgb(${Math.max(0,r-Math.round(amount*255))},${Math.max(0,g-Math.round(amount*255))},${Math.max(0,b-Math.round(amount*255))})`;
}
