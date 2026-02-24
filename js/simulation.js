/**
 * simulation.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Core simulation engine.
 *
 * Lifecycle per generation:
 *   1. Run matches  — randomly pair blobs, play N rounds, award payoffs.
 *   2. Reproduce    — blobs at/above reproThreshold spawn a child (energy split).
 *   3. Age & clean  — increment blob age, remove dead blobs (score < deathThreshold).
 *   4. Record stats — snapshot population, events for charting.
 *   5. Fire events  — notify listeners (renderer, charts, UI).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Blob, resetBlobIds } from './blob.js';
import { STRATEGIES, STRATEGY_MAP } from './strategies.js';
import { COOPERATE, DEFECT } from './strategies.js';

// ─── Default Parameters ───────────────────────────────────────────────────────

export const DEFAULT_PARAMS = {
  // Simulation
  speed:          0.1,      // generations per animation frame (1–50)
  maxGenerations: 500,
  // Population
  initialPop:     60,
  initScore:      5.0,
  deathThreshold: 0.1,
  reproThreshold: 10.0,
  mutationRate:   0.05,   // 0–1
  maxPop:         300,
  // Matches
  roundsPerMatch:  5,
  matchesPerGen:   10,
  memoryLen:       5,
  // Payoff matrix (Prisoner's Dilemma)
  payoff: { T: 5, R: 3, P: 1, S: 0 },
  // Strategy initial weights (id → %)
  strategyWeights: Object.fromEntries(STRATEGIES.map(s => [s.id, s.weight])),
};

// ─── Payoff helper ────────────────────────────────────────────────────────────

function calcPayoffs(moveA, moveB, payoff) {
  const { T, R, P, S } = payoff;
  if (moveA === COOPERATE && moveB === COOPERATE) return [R, R];
  if (moveA === COOPERATE && moveB === DEFECT)    return [S, T];
  if (moveA === DEFECT    && moveB === COOPERATE) return [T, S];
  return [P, P];
}

// ─── Fisher-Yates shuffle (in-place) ─────────────────────────────────────────

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Weighted random strategy selection ──────────────────────────────────────

function weightedRandomStrategy(weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [id, w] of Object.entries(weights)) {
    r -= w;
    if (r <= 0) return id;
  }
  return STRATEGIES[STRATEGIES.length - 1].id;
}

// ─── Simulation class ─────────────────────────────────────────────────────────

export class Simulation {
  /**
   * @param {object} params - Merged simulation parameters
   */
  constructor(params) {
    this.params = { ...DEFAULT_PARAMS, ...params, payoff: { ...DEFAULT_PARAMS.payoff, ...(params.payoff || {}) } };
    this.generation  = 0;
    this.blobs       = [];
    this.history     = [];  // array of GenerationSnapshot

    // Cumulative totals
    this.totalBirths    = 0;
    this.totalDeaths    = 0;
    this.totalMutations = 0;

    // Event log (last N entries)
    this.eventLog = [];

    // Listeners
    this._listeners = {};

    // Running state
    this._running = false;
    this._rafId   = null;
    this._stepAccumulator = 0;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /** Initialise and populate blobs. */
  init() {
    resetBlobIds();
    this.generation     = 0;
    this.blobs          = [];
    this.history        = [];
    this.eventLog       = [];
    this.totalBirths    = 0;
    this.totalDeaths    = 0;
    this.totalMutations = 0;

    const { initialPop, initScore, strategyWeights } = this.params;
    for (let i = 0; i < initialPop; i++) {
      const stratId = weightedRandomStrategy(strategyWeights);
      this.blobs.push(new Blob(stratId, initScore));
    }

    this._snapshot();
    this.emit('init', { blobs: this.blobs, params: this.params });
  }

  /** Start auto-running the simulation. */
  start() {
    if (this._running) return;
    this._running = true;
    this.emit('stateChange', { running: true });
    this._loop();
  }

  /** Pause auto-run. */
  pause() {
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = null;
    this.emit('stateChange', { running: false });
  }

  /** Advance exactly one generation. */
  step() {
    if (this.generation >= this.params.maxGenerations) return;
    this._runGeneration();
  }

  /** Is the simulation currently auto-running? */
  get isRunning() { return this._running; }

  /** Is the simulation finished? */
  get isFinished() {
    return this.generation >= this.params.maxGenerations || this.blobs.length === 0;
  }

  // ─── Core loop ───────────────────────────────────────────────────────────────

  _loop() {
    if (!this._running) return;
    if (this.isFinished) {
      this._running = false;
      this.emit('finished', { generation: this.generation });
      return;
    }

    const stepsThisFrame = Math.max(1, Math.round(this.params.speed));
    for (let i = 0; i < stepsThisFrame; i++) {
      if (!this.isFinished) this._runGeneration();
    }

    this._rafId = requestAnimationFrame(() => this._loop());
  }

  // ─── Generation Logic ────────────────────────────────────────────────────────

  _runGeneration() {
    this.generation++;
    const genBirths    = [];
    const genDeaths    = [];
    const genMutations = [];

    // ── 1. Matches ────────────────────────────────────────────────────────────
    this._runMatches();

    // ── 2. Reproduction ───────────────────────────────────────────────────────
    const candidates = [...this.blobs]; // snapshot before mutation adds children
    for (const blob of candidates) {
      if (this.blobs.length >= this.params.maxPop) break;
      const child = blob.tryReproduce(this.params);
      if (child) {
        this.blobs.push(child);
        this.totalBirths++;
        genBirths.push(child);
        if (child.mutated) {
          this.totalMutations++;
          genMutations.push(child);
        }
      }
    }

    // ── 3. Age & Deaths ───────────────────────────────────────────────────────
    const survivors = [];
    for (const blob of this.blobs) {
      blob.tick();
      if (blob.isDead(this.params.deathThreshold)) {
        this.totalDeaths++;
        genDeaths.push(blob);
      } else {
        survivors.push(blob);
      }
    }
    this.blobs = survivors;

    // ── 4. Log events ─────────────────────────────────────────────────────────
    for (const b of genBirths) {
      this._log('birth',  `Gen ${this.generation}: ${b.strategy.name} born (id ${b.id}${b.mutated ? ', MUTATED' : ''})`,'birth');
    }
    for (const b of genDeaths) {
      this._log('death',  `Gen ${this.generation}: ${b.strategy.name} died (id ${b.id}, age ${b.age})`, 'death');
    }
    for (const b of genMutations) {
      this._log('mutate', `Gen ${this.generation}: id ${b.id} mutated → ${b.strategy.name}`, 'mutate');
    }

    // ── 5. Snapshot & emit ─────────────────────────────────────────────────────
    const snap = this._snapshot();
    this.emit('generation', {
      generation:  this.generation,
      blobs:       this.blobs,
      snapshot:    snap,
      births:      genBirths,
      deaths:      genDeaths,
      mutations:   genMutations,
      totalBirths:    this.totalBirths,
      totalDeaths:    this.totalDeaths,
      totalMutations: this.totalMutations,
    });
  }

  // ─── Match Engine ────────────────────────────────────────────────────────────

  _runMatches() {
    const { roundsPerMatch, matchesPerGen, memoryLen, payoff } = this.params;
    const blobList = this.blobs;
    if (blobList.length < 2) return;

    for (let m = 0; m < matchesPerGen; m++) {
      // Shuffle and create pairs
      const shuffled = shuffle([...blobList]);
      // If odd number, last blob sits out
      for (let i = 0; i + 1 < shuffled.length; i += 2) {
        const a = shuffled[i];
        const b = shuffled[i + 1];
        this._playMatch(a, b, roundsPerMatch, memoryLen, payoff);
      }
    }
  }

  _playMatch(blobA, blobB, rounds, memoryLen, payoff) {
    let totalPayoffA = 0;
    let totalPayoffB = 0;

    for (let r = 0; r < rounds; r++) {
      const moveA = blobA.decide(blobB.id, this.params, memoryLen);
      const moveB = blobB.decide(blobA.id, this.params, memoryLen);

      const [pa, pb] = calcPayoffs(moveA, moveB, payoff);

      // Record round in each blob's memory
      blobA.recordRound(blobB.id, moveA, moveB, memoryLen);
      blobB.recordRound(blobA.id, moveB, moveA, memoryLen);

      // Scale payoffs to avoid runaway scores
      // Divide by (matchesPerGen * rounds) to normalise per generation
      const scale = 1 / (this.params.matchesPerGen * rounds);
      blobA.applyPayoff(pa * scale);
      blobB.applyPayoff(pb * scale);

      totalPayoffA += pa;
      totalPayoffB += pb;
    }

    blobA.recordMatchOutcome(totalPayoffA, totalPayoffB);
    blobB.recordMatchOutcome(totalPayoffB, totalPayoffA);
  }

  // ─── Snapshot ────────────────────────────────────────────────────────────────

  _snapshot() {
    const counts    = {};
    const scoreSums = {};
    const winSums   = {};

    for (const s of STRATEGIES) {
      counts[s.id]    = 0;
      scoreSums[s.id] = 0;
      winSums[s.id]   = 0;
    }

    for (const b of this.blobs) {
      counts[b.strategyId]++;
      scoreSums[b.strategyId] += b.score;
      winSums[b.strategyId]   += b.wins;
    }

    const avgScores = {};
    for (const s of STRATEGIES) {
      avgScores[s.id] = counts[s.id] > 0
        ? scoreSums[s.id] / counts[s.id]
        : 0;
    }

    const snap = {
      generation:     this.generation,
      totalPop:       this.blobs.length,
      counts,
      avgScores,
      winSums,
      totalBirths:    this.totalBirths,
      totalDeaths:    this.totalDeaths,
      totalMutations: this.totalMutations,
    };

    this.history.push(snap);
    // Keep last 1000 snapshots to avoid unbounded memory
    if (this.history.length > 1000) this.history.shift();

    return snap;
  }

  // ─── Event bus ───────────────────────────────────────────────────────────────

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  }

  off(event, fn) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(f => f !== fn);
  }

  emit(event, data) {
    if (!this._listeners[event]) return;
    for (const fn of this._listeners[event]) fn(data);
  }

  // ─── Logging ─────────────────────────────────────────────────────────────────

  _log(type, message, cssClass = 'info') {
    const entry = { type, message, cssClass, generation: this.generation };
    this.eventLog.unshift(entry);
    if (this.eventLog.length > 200) this.eventLog.pop();
    this.emit('log', entry);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /** Returns the currently dominant strategy (most blobs). */
  getDominant() {
    if (this.blobs.length === 0) return null;
    const counts = {};
    for (const b of this.blobs) {
      counts[b.strategyId] = (counts[b.strategyId] || 0) + 1;
    }
    const topId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    return STRATEGY_MAP[topId];
  }

  /** Returns per-strategy statistics for the current generation. */
  getStrategyStats() {
    const stats = {};
    for (const s of STRATEGIES) {
      stats[s.id] = { count: 0, totalScore: 0, wins: 0, losses: 0 };
    }
    for (const b of this.blobs) {
      stats[b.strategyId].count++;
      stats[b.strategyId].totalScore += b.score;
      stats[b.strategyId].wins   += b.wins;
      stats[b.strategyId].losses += b.losses;
    }
    return STRATEGIES.map(s => ({
      ...s,
      count:    stats[s.id].count,
      avgScore: stats[s.id].count > 0 ? stats[s.id].totalScore / stats[s.id].count : 0,
      wins:     stats[s.id].wins,
      losses:   stats[s.id].losses,
    })).sort((a, b) => b.count - a.count);
  }
}
