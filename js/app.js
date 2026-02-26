/* ═══════════════════════════════════════════════════════════════════════════
   EvoBlob — Bundled App (no ES module imports; works with file:// protocol)
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

/* ─── strategies.js ──────────────────────────────────────────────────────── */

const COOPERATE = 'C';
const DEFECT    = 'D';

function opponentHistory(memory, n = Infinity) {
  return memory.slice(-n).map(r => r.opponentMove);
}
function opponentDefectCount(memory, n = Infinity) {
  return opponentHistory(memory, n).filter(m => m === DEFECT).length;
}
function lastOpponentMove(memory) {
  return memory.length > 0 ? memory[memory.length - 1].opponentMove : null;
}
function lastMyMove(memory) {
  return memory.length > 0 ? memory[memory.length - 1].myMove : null;
}

function alwaysCooperate(_memory) { return COOPERATE; }
function alwaysDefect(_memory)    { return DEFECT; }

function titForTat(memory) {
  if (memory.length === 0) return COOPERATE;
  return lastOpponentMove(memory);
}

function titForTwoTats(memory) {
  if (memory.length < 2) return COOPERATE;
  const last2 = memory.slice(-2).map(r => r.opponentMove);
  return last2.every(m => m === DEFECT) ? DEFECT : COOPERATE;
}

function grudger(memory) {
  if (opponentDefectCount(memory) > 0) return DEFECT;
  return COOPERATE;
}

function _getPayoff(myMove, opponentMove, params) {
  const { T, R, P, S } = params.payoff;
  if (myMove === COOPERATE && opponentMove === COOPERATE) return R;
  if (myMove === COOPERATE && opponentMove === DEFECT)    return S;
  if (myMove === DEFECT    && opponentMove === COOPERATE) return T;
  return P;
}

function pavlov(memory, _opponentId, params) {
  if (memory.length === 0) return COOPERATE;
  const last   = memory[memory.length - 1];
  const payoff = _getPayoff(last.myMove, last.opponentMove, params);
  if (payoff > params.payoff.P) return last.myMove;
  return last.myMove === COOPERATE ? DEFECT : COOPERATE;
}

function random(_memory) {
  return Math.random() < 0.5 ? COOPERATE : DEFECT;
}

function generousTitForTat(memory) {
  if (memory.length === 0) return COOPERATE;
  if (lastOpponentMove(memory) === COOPERATE) return COOPERATE;
  return Math.random() < 0.10 ? COOPERATE : DEFECT;
}

function detective(memory) {
  const PROBE = [COOPERATE, DEFECT, COOPERATE, COOPERATE];
  const n = memory.length;
  if (n < PROBE.length) return PROBE[n];
  const probeOpponent = memory.slice(0, 4).map(r => r.opponentMove);
  const retaliated = probeOpponent.includes(DEFECT);
  if (!retaliated) return DEFECT;
  return lastOpponentMove(memory);
}

function softMajority(memory) {
  if (memory.length === 0) return COOPERATE;
  const total = memory.length;
  const coops = memory.filter(r => r.opponentMove === COOPERATE).length;
  return coops >= total / 2 ? COOPERATE : DEFECT;
}

const STRATEGIES = [
  { id:'alwaysCooperate',    name:'Always Cooperate',  short:'AC',   desc:'Never defects — the pacifist.',                              color:'#66bb6a', decide:alwaysCooperate,    weight:10 },
  { id:'alwaysDefect',       name:'Always Defect',     short:'AD',   desc:'Never cooperates — the exploiter.',                          color:'#ef5350', decide:alwaysDefect,       weight:10 },
  { id:'titForTat',          name:'Tit-for-Tat',       short:'TFT',  desc:"Mirrors the opponent's last move.",                          color:'#42a5f5', decide:titForTat,          weight:11 },
  { id:'titForTwoTats',      name:'Tit-for-Two-Tats',  short:'TF2T', desc:'Forgives a single defection.',                               color:'#26c6da', decide:titForTwoTats,      weight:10 },
  { id:'grudger',            name:'Grudger',            short:'GR',   desc:'Cooperates until betrayed once, then defects forever.',      color:'#ff7043', decide:grudger,            weight:10 },
  { id:'pavlov',             name:'Pavlov',             short:'PV',   desc:'Win-stay, lose-shift.',                                     color:'#ab47bc', decide:pavlov,             weight:10 },
  { id:'random',             name:'Random',             short:'RN',   desc:'50/50 cooperation each round.',                             color:'#bdbdbd', decide:random,             weight:10 },
  { id:'generousTitForTat',  name:'Generous TFT',       short:'GTFT', desc:'TFT that occasionally forgives defection (10%).',           color:'#29b6f6', decide:generousTitForTat,  weight:10 },
  { id:'detective',          name:'Detective',           short:'DT',   desc:'Probes then exploits or uses TFT.',                         color:'#ffa726', decide:detective,          weight:10 },
  { id:'softMajority',       name:'Soft Majority',      short:'SM',   desc:'Cooperates if opponent cooperated in majority of rounds.',   color:'#a5d6a7', decide:softMajority,       weight:9  },
];

const STRATEGY_MAP = Object.fromEntries(STRATEGIES.map(s => [s.id, s]));

function randomStrategyId() {
  return STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)].id;
}
function mutateStrategy(currentId) {
  const others = STRATEGIES.filter(s => s.id !== currentId);
  return others[Math.floor(Math.random() * others.length)].id;
}

/* ─── blob.js ────────────────────────────────────────────────────────────── */

let _nextBlobId = 1;

class Blob {
  constructor(strategyId, score, parent = null, mutated = false) {
    this.id         = _nextBlobId++;
    this.strategyId = strategyId;
    this.score      = score;
    this.age        = 0;
    this.generation = parent ? parent.generation + 1 : 0;
    this.parentId   = parent ? parent.id : null;
    this.mutated    = mutated;

    this.wins   = 0;
    this.losses = 0;
    this.draws  = 0;
    this.totalRoundsPlayed = 0;
    this.cooperations      = 0;
    this.defections        = 0;

    this.memory = new Map();

    this.x  = Math.random();
    this.y  = Math.random();
    this.vx = (Math.random() - 0.5) * 0.002;
    this.vy = (Math.random() - 0.5) * 0.002;
    this.displayRadius = 0;
    this.glowIntensity = 0;
    this.pulsePhase    = Math.random() * Math.PI * 2;
  }

  get strategy() { return STRATEGY_MAP[this.strategyId]; }

  decide(opponentId, params, memoryLen) {
    const history = this.getMemory(opponentId, memoryLen);
    return this.strategy.decide(history, opponentId, params);
  }

  recordRound(opponentId, myMove, opponentMove, memoryLen, misunderstandingRate = 0) {
    if (!this.memory.has(opponentId)) this.memory.set(opponentId, []);
    const hist = this.memory.get(opponentId);
    // Misunderstanding: with some probability we misremember the opponent's move
    const rememberedMove = (misunderstandingRate > 0 && Math.random() < misunderstandingRate)
      ? (opponentMove === COOPERATE ? DEFECT : COOPERATE)
      : opponentMove;
    hist.push({ myMove, opponentMove: rememberedMove });
    if (hist.length > memoryLen) hist.splice(0, hist.length - memoryLen);
    this.totalRoundsPlayed++;
    if (myMove === 'C') this.cooperations++; else this.defections++;
  }

  getMemory(opponentId, memoryLen = Infinity) {
    const hist = this.memory.get(opponentId) || [];
    return hist.slice(-memoryLen);
  }

  applyPayoff(delta) { this.score = Math.max(0, this.score + delta); }

  recordMatchOutcome(myTotal, opponentTotal) {
    if (myTotal > opponentTotal) this.wins++;
    else if (myTotal < opponentTotal) this.losses++;
    else this.draws++;
  }

  tryReproduce(params) {
    if (this.score < params.reproThreshold) return null;
    const mutated = Math.random() < params.mutationRate;
    const childStrategyId = mutated ? mutateStrategy(this.strategyId) : this.strategyId;
    this.score /= 2;
    const child = new Blob(childStrategyId, this.score, this, mutated);
    child.x = Math.min(1, Math.max(0, this.x + (Math.random() - 0.5) * 0.05));
    child.y = Math.min(1, Math.max(0, this.y + (Math.random() - 0.5) * 0.05));
    return child;
  }

  isDead(deathThreshold, maxAge = 0) {
    if (this.score < deathThreshold) return true;
    if (maxAge > 0 && this.age >= maxAge) return true;
    return false;
  }

  tick() { this.age++; this.pulsePhase += 0.05; }

  toDisplay() {
    const coop = this.totalRoundsPlayed > 0
      ? Math.round((this.cooperations / this.totalRoundsPlayed) * 100) : 0;
    return {
      id: this.id, strategy: this.strategy.name, color: this.strategy.color,
      score: this.score.toFixed(2), age: this.age, gen: this.generation,
      wins: this.wins, losses: this.losses, draws: this.draws,
      coopRate: coop, mutated: this.mutated,
    };
  }
}

function resetBlobIds() { _nextBlobId = 1; }

/* ─── simulation.js ──────────────────────────────────────────────────────── */

const DEFAULT_PARAMS = {
  speed: 0.5, maxGenerations: 1000,
  initialPop: 60, initScore: 5.0,
  metabolismCost: 1.5, deathThreshold: 1.0, reproThreshold: 8.0,
  mutationRate: 0.05, maxPop: 300,
  roundsPerMatch: 5, matchesPerGen: 10, memoryLen: 5,
  neighborProb: 0.5, misunderstandingRate: 0.05, maxAge: 0,
  payoff: { T: 5, R: 3, P: 1, S: 0 },
  strategyWeights: Object.fromEntries(STRATEGIES.map(s => [s.id, s.weight])),
};

function _calcPayoffs(moveA, moveB, payoff) {
  const { T, R, P, S } = payoff;
  if (moveA === COOPERATE && moveB === COOPERATE) return [R, R];
  if (moveA === COOPERATE && moveB === DEFECT)    return [S, T];
  if (moveA === DEFECT    && moveB === COOPERATE) return [T, S];
  return [P, P];
}

function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function _weightedRandomStrategy(weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (total === 0) return STRATEGIES[0].id;
  let r = Math.random() * total;
  for (const [id, w] of Object.entries(weights)) {
    r -= w;
    if (r <= 0) return id;
  }
  return STRATEGIES[STRATEGIES.length - 1].id;
}

class Simulation {
  constructor(params) {
    this.params = {
      ...DEFAULT_PARAMS, ...params,
      payoff: { ...DEFAULT_PARAMS.payoff, ...(params.payoff || {}) },
    };
    this.generation     = 0;
    this.blobs          = [];
    this.history        = [];
    this.totalBirths    = 0;
    this.totalDeaths    = 0;
    this.totalMutations = 0;
    this.eventLog       = [];
    this._listeners     = {};
    this._running       = false;
    this._rafId         = null;
  }

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
      this.blobs.push(new Blob(_weightedRandomStrategy(strategyWeights), initScore));
    }
    this._snapshot();
    this.emit('init', { blobs: this.blobs, params: this.params });
  }

  start() {
    if (this._running) return;
    this._running = true;
    this.emit('stateChange', { running: true });
    this._loop();
  }

  pause() {
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = null;
    this.emit('stateChange', { running: false });
  }

  step() {
    if (this.isFinished) return;
    this._runGeneration();
  }

  get isRunning()  { return this._running; }
  get isFinished() { return this.generation >= this.params.maxGenerations || this.blobs.length === 0; }

  _loop() {
    if (!this._running) return;
    if (this.isFinished) {
      this._running = false;
      this.emit('finished', { generation: this.generation });
      return;
    }
    // fractional speed: accumulate credits each frame, consume 1 gen per credit
    this._frameCredit = (this._frameCredit || 0) + Math.max(0.01, this.params.speed);
    while (this._frameCredit >= 1 && !this.isFinished) {
      this._runGeneration();
      this._frameCredit -= 1;
    }
    this._rafId = requestAnimationFrame(() => this._loop());
  }

  _runGeneration() {
    this.generation++;
    const genBirths    = [];
    const genDeaths    = [];
    const genMutations = [];

    const genMatchups = this._runMatches();
    const candidates = _shuffle([...this.blobs]);
    for (const blob of candidates) {
      if (this.blobs.length >= this.params.maxPop) break;
      const child = blob.tryReproduce(this.params);
      if (child) {
        this.blobs.push(child);
        this.totalBirths++;
        genBirths.push(child);
        if (child.mutated) { this.totalMutations++; genMutations.push(child); }
      }
    }

    const survivors = [];
    for (const blob of this.blobs) {
      blob.tick();
      blob.applyPayoff(-this.params.metabolismCost);   // metabolic drain each generation
      if (blob.isDead(this.params.deathThreshold, this.params.maxAge)) {
        this.totalDeaths++;
        genDeaths.push(blob);
      } else {
        survivors.push(blob);
      }
    }
    this.blobs = survivors;

    for (const b of genBirths)    this._log(`Gen ${this.generation}: ${b.strategy.name} born (id ${b.id}${b.mutated ? ', MUTATED' : ''})`, 'birth');
    for (const b of genDeaths)    this._log(`Gen ${this.generation}: ${b.strategy.name} died (id ${b.id}, age ${b.age})`, 'death');
    for (const b of genMutations) this._log(`Gen ${this.generation}: id ${b.id} mutated → ${b.strategy.name}`, 'mutate');

    const snap = this._snapshot();
    this.emit('generation', {
      generation: this.generation, blobs: this.blobs, snapshot: snap,
      births: genBirths, deaths: genDeaths, mutations: genMutations,
      matchups: genMatchups,
      totalBirths: this.totalBirths, totalDeaths: this.totalDeaths,
      totalMutations: this.totalMutations,
    });
  }

  _runMatches() {
    const { roundsPerMatch, matchesPerGen, memoryLen, payoff, neighborProb } = this.params;
    const allMatchups = [];
    if (this.blobs.length < 2) return allMatchups;
    for (let m = 0; m < matchesPerGen; m++) {
      const useNeighbors = Math.random() < (neighborProb || 0);
      const pairs = useNeighbors ? this._neighborPairs() : this._randomPairs();
      for (const [a, b] of pairs) {
        const result = this._playMatch(a, b, roundsPerMatch, memoryLen, payoff);
        allMatchups.push(result);
      }
    }
    const cap = 60;
    if (allMatchups.length <= cap) return allMatchups;
    const step = Math.max(1, Math.floor(allMatchups.length / cap));
    return allMatchups.filter((_, i) => i % step === 0).slice(0, cap);
  }

  _randomPairs() {
    const shuffled = _shuffle([...this.blobs]);
    const pairs = [];
    for (let i = 0; i + 1 < shuffled.length; i += 2) pairs.push([shuffled[i], shuffled[i + 1]]);
    return pairs;
  }

  _neighborPairs() {
    const used = new Set();
    const pairs = [];
    const blobs = _shuffle([...this.blobs]);
    for (let i = 0; i < blobs.length; i++) {
      const a = blobs[i];
      if (used.has(a.id)) continue;
      let best = null, bestDist = Infinity;
      for (let j = 0; j < blobs.length; j++) {
        if (i === j || used.has(blobs[j].id)) continue;
        const dx = a.x - blobs[j].x, dy = a.y - blobs[j].y;
        const d = dx * dx + dy * dy;
        if (d < bestDist) { bestDist = d; best = blobs[j]; }
      }
      if (best) { pairs.push([a, best]); used.add(a.id); used.add(best.id); }
    }
    return pairs;
  }

  _playMatch(blobA, blobB, rounds, memoryLen, payoff) {
    let totalA = 0, totalB = 0;
    const scale = 1 / (this.params.matchesPerGen * rounds);
    const misRate = this.params.misunderstandingRate || 0;
    const moves = [];
    for (let r = 0; r < rounds; r++) {
      const moveA = blobA.decide(blobB.id, this.params, memoryLen);
      const moveB = blobB.decide(blobA.id, this.params, memoryLen);
      const [pa, pb] = _calcPayoffs(moveA, moveB, payoff);
      blobA.recordRound(blobB.id, moveA, moveB, memoryLen, misRate);
      blobB.recordRound(blobA.id, moveB, moveA, memoryLen, misRate);
      blobA.applyPayoff(pa * scale);
      blobB.applyPayoff(pb * scale);
      totalA += pa; totalB += pb;
      moves.push({ moveA, moveB });
    }
    blobA.recordMatchOutcome(totalA, totalB);
    blobB.recordMatchOutcome(totalB, totalA);
    return { idA: blobA.id, idB: blobB.id, stratA: blobA.strategyId, stratB: blobB.strategyId,
             ax: blobA.x, ay: blobA.y, bx: blobB.x, by: blobB.y, moves, totalA, totalB };
  }

  _snapshot() {
    const counts = {}, scoreSums = {}, winSums = {};
    for (const s of STRATEGIES) { counts[s.id] = 0; scoreSums[s.id] = 0; winSums[s.id] = 0; }
    for (const b of this.blobs) {
      counts[b.strategyId]++;
      scoreSums[b.strategyId] += b.score;
      winSums[b.strategyId]   += b.wins;
    }
    const avgScores = {};
    for (const s of STRATEGIES) {
      avgScores[s.id] = counts[s.id] > 0 ? scoreSums[s.id] / counts[s.id] : 0;
    }
    const snap = {
      generation: this.generation, totalPop: this.blobs.length,
      counts, avgScores, winSums,
      totalBirths: this.totalBirths, totalDeaths: this.totalDeaths,
      totalMutations: this.totalMutations,
    };
    this.history.push(snap);
    if (this.history.length > 1000) this.history.shift();
    return snap;
  }

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

  _log(message, cssClass = 'info') {
    const entry = { message, cssClass, generation: this.generation };
    this.eventLog.unshift(entry);
    if (this.eventLog.length > 200) this.eventLog.pop();
    this.emit('log', entry);
  }

  getDominant() {
    if (this.blobs.length === 0) return null;
    const counts = {};
    for (const b of this.blobs) counts[b.strategyId] = (counts[b.strategyId] || 0) + 1;
    const topId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    return STRATEGY_MAP[topId];
  }

  getStrategyStats() {
    const stats = {};
    for (const s of STRATEGIES) stats[s.id] = { count: 0, totalScore: 0, wins: 0, losses: 0 };
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
    })).sort((a, b) => b.count - a.count);
  }
}

/* ─── renderer.js ────────────────────────────────────────────────────────── */

const MIN_RADIUS = 4;
const MAX_RADIUS = 18;
const DAMPING    = 0.95;
const SPEED_BASE = 0.0004;

class Renderer {
  constructor(canvas, tooltipEl) {
    this.canvas   = canvas;
    this.ctx      = canvas.getContext('2d');
    this.tooltip  = tooltipEl;
    this.blobs    = [];
    this.newborns = new Set();
    this._dying   = [];
    this._battles = [];
    this._blobMap = new Map();
    this._rafId   = null;
    this._running = false;
    this._hoveredBlob = null;
    this.showAge  = false;

    // Pan / zoom
    this._panX = 0; this._panY = 0; this._zoom = 1;
    this._dragging = false; this._dragStart = null; this._panStart = null;

    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(canvas.parentElement);
    this._resize();

    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this._dragging = true;
      this._dragStart = { x: e.clientX, y: e.clientY };
      this._panStart  = { x: this._panX, y: this._panY };
      canvas.style.cursor = 'grabbing';
    });
    canvas.addEventListener('mousemove', (e) => {
      if (this._dragging) {
        this._panX = this._panStart.x + (e.clientX - this._dragStart.x);
        this._panY = this._panStart.y + (e.clientY - this._dragStart.y);
      } else {
        this._onMouseMove(e);
      }
    });
    canvas.addEventListener('mouseup',   () => { this._dragging = false; canvas.style.cursor = 'default'; });
    canvas.addEventListener('mouseleave', () => {
      this._dragging = false;
      this._hoveredBlob = null;
      if (this.tooltip) this.tooltip.style.display = 'none';
      canvas.style.cursor = 'default';
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      this._panX = mx - (mx - this._panX) * factor;
      this._panY = my - (my - this._panY) * factor;
      this._zoom = Math.max(0.25, Math.min(10, this._zoom * factor));
    }, { passive: false });
  }

  resetView() { this._panX = 0; this._panY = 0; this._zoom = 1; }

  update(blobs, births = [], deaths = [], matchups = []) {
    const newIds = new Set(blobs.map(b => b.id));
    // Collect dying blobs: use explicit deaths list or diff against previous blobs
    const deadBlobs = deaths.length > 0 ? deaths : this.blobs.filter(b => !newIds.has(b.id));
    for (const db of deadBlobs) {
      this._dying.push({
        x: db.x, y: db.y,
        vx: (Math.random() - 0.5) * 0.003,
        vy: (Math.random() - 0.5) * 0.001 - 0.0015,
        r: db.displayRadius > 0 ? db.displayRadius : 8,
        strategyId: db.strategyId,
        ttl: 40, maxTtl: 40,
      });
    }
    this.blobs    = blobs;
    this.newborns = new Set(births.map(b => b.id));
    // Rebuild fast lookup map
    this._blobMap.clear();
    for (const b of this.blobs) this._blobMap.set(b.id, b);
    for (const blob of this.blobs) {
      blob.glowIntensity = this.newborns.has(blob.id)
        ? 1.0
        : Math.max(0, blob.glowIntensity - 0.02);
    }
    // Register new battles — use arena positions captured at match time
    this._battles = matchups.map(m => ({
      idA: m.idA, idB: m.idB,
      stratA: m.stratA, stratB: m.stratB,
      // Arena midpoint is fixed at the positions where blobs WERE when matched
      arenaX: ((m.ax + m.bx) / 2), arenaY: ((m.ay + m.by) / 2),
      rax: m.ax, ray: m.ay, rbx: m.bx, rby: m.by,
      moves: m.moves,
      totalA: m.totalA, totalB: m.totalB,
      ttl: 100, maxTtl: 100,
      roundIdx: 0,
      roundTimer: 0,
    }));
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._frame();
  }

  stop() {
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = null;
  }

  _resize() {
    const parent = this.canvas.parentElement;
    this.canvas.width  = parent.clientWidth  || 600;
    this.canvas.height = parent.clientHeight || 450;
  }

  _frame() {
    if (!this._running) return;
    this._tick();
    this._draw();
    this._rafId = requestAnimationFrame(() => this._frame());
  }

  _tick() {
    const W = this.canvas.width;
    const H = this.canvas.height;

    // ── Move live blobs ──────────────────────────────────────────────────────
    for (const blob of this.blobs) {
      blob.vx += (Math.random() - 0.5) * SPEED_BASE;
      blob.vy += (Math.random() - 0.5) * SPEED_BASE;
      blob.vx *= DAMPING;
      blob.vy *= DAMPING;
      blob.x  += blob.vx;
      blob.y  += blob.vy;
      const pad = 0.02;
      if (blob.x < pad)     { blob.x = pad;     blob.vx =  Math.abs(blob.vx); }
      if (blob.x > 1 - pad) { blob.x = 1 - pad; blob.vx = -Math.abs(blob.vx); }
      if (blob.y < pad)     { blob.y = pad;     blob.vy =  Math.abs(blob.vy); }
      if (blob.y > 1 - pad) { blob.y = 1 - pad; blob.vy = -Math.abs(blob.vy); }
      const scoreNorm = Math.min(blob.score / 10, 1);
      blob.displayRadius = MIN_RADIUS + scoreNorm * (MAX_RADIUS - MIN_RADIUS);
    }

    // ── Blob collision (bumping) ─────────────────────────────────────────────
    for (let i = 0; i < this.blobs.length; i++) {
      for (let j = i + 1; j < this.blobs.length; j++) {
        const a = this.blobs[i], b = this.blobs[j];
        const ax = a.x * W, ay = a.y * H;
        const bx = b.x * W, by = b.y * H;
        const dx = bx - ax, dy = by - ay;
        const dist = Math.hypot(dx, dy);
        const minD = a.displayRadius + b.displayRadius;
        if (dist < minD && dist > 0.1) {
          const nx = dx / dist, ny = dy / dist;
          // Separate blobs so they no longer overlap
          const overlap = (minD - dist) * 0.5;
          a.x -= nx * overlap / W;  a.y -= ny * overlap / H;
          b.x += nx * overlap / W;  b.y += ny * overlap / H;
          // Elastic velocity exchange along collision normal
          const avxPx = a.vx * W, avyPx = a.vy * H;
          const bvxPx = b.vx * W, bvyPx = b.vy * H;
          const dot = (avxPx - bvxPx) * nx + (avyPx - bvyPx) * ny;
          if (dot > 0) {
            a.vx -= dot * nx / W;  a.vy -= dot * ny / H;
            b.vx += dot * nx / W;  b.vy += dot * ny / H;
          }
        }
      }
    }

    // ── Animate dying blobs ──────────────────────────────────────────────────
    for (let i = this._dying.length - 1; i >= 0; i--) {
      const d = this._dying[i];
      d.ttl--;
      if (d.ttl <= 0) { this._dying.splice(i, 1); continue; }
      d.x  += d.vx;
      d.y  += d.vy;
      d.y  -= 0.0003;   // float upward
      d.vx *= 0.96;
      d.vy *= 0.96;
    }

    // ── Age battle overlays ──────────────────────────────────────────────────
    for (let i = this._battles.length - 1; i >= 0; i--) {
      const bat = this._battles[i];
      bat.ttl--;
      if (bat.ttl <= 0) { this._battles.splice(i, 1); continue; }
      bat.roundTimer++;
      const framesPerRound = Math.max(4, Math.floor(bat.maxTtl / (bat.moves.length + 1)));
      if (bat.roundTimer >= framesPerRound) {
        bat.roundTimer = 0;
        if (bat.roundIdx < bat.moves.length - 1) bat.roundIdx++;
      }
    }
  }

  _draw() {
    const ctx = this.ctx;
    const W   = this.canvas.width;
    const H   = this.canvas.height;
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    ctx.translate(this._panX, this._panY);
    ctx.scale(this._zoom, this._zoom);

    // Grid
    ctx.save();
    ctx.strokeStyle = 'rgba(46,74,46,0.12)';
    ctx.lineWidth   = 1 / this._zoom;
    const gridSize  = 60;
    for (let x = 0; x < W; x += gridSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += gridSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.restore();

    const t = performance.now() / 1000;
    for (const d of this._dying) this._drawDyingBlob(ctx, d, W, H);
    this._drawBattles(ctx, W, H);

    if (this.blobs.length === 0) { this._drawEmpty(ctx, W, H); ctx.restore(); return; }

    const sorted = [...this.blobs].sort((a, b) => b.displayRadius - a.displayRadius);
    for (const blob of sorted) this._drawBlob(ctx, blob, W, H, t);
    if (this._hoveredBlob) this._drawHoverOutline(ctx, this._hoveredBlob, W, H);

    ctx.restore();
  }

  _drawBlob(ctx, blob, W, H, t) {
    const cx    = blob.x * W;
    const cy    = blob.y * H;
    const r     = blob.displayRadius;
    const color = STRATEGY_MAP[blob.strategyId] ? STRATEGY_MAP[blob.strategyId].color : '#aaa';
    const pulse = 1 + Math.sin(blob.pulsePhase + t * 1.5) * 0.04;
    const pr    = r * pulse;

    if (blob.glowIntensity > 0) {
      const glowR = pr + 8 * blob.glowIntensity;
      const grd   = ctx.createRadialGradient(cx, cy, pr * 0.5, cx, cy, glowR);
      grd.addColorStop(0, color + Math.round(blob.glowIntensity * 80).toString(16).padStart(2, '0'));
      grd.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fillStyle = grd; ctx.fill();
    }

    const bodyGrd = ctx.createRadialGradient(cx - pr * 0.25, cy - pr * 0.25, pr * 0.05, cx, cy, pr);
    bodyGrd.addColorStop(0, _lighten(color, 0.4));
    bodyGrd.addColorStop(0.6, color);
    bodyGrd.addColorStop(1, _darken(color, 0.35));
    ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrd; ctx.fill();

    ctx.strokeStyle = _lighten(color, 0.2);
    ctx.lineWidth   = 1.2;
    ctx.stroke();

    if (pr > 9) {
      ctx.fillStyle    = 'rgba(255,255,255,0.85)';
      ctx.font         = `bold ${Math.round(pr * 0.55)}px monospace`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(parseFloat(blob.score).toFixed(1), cx, cy);
    }
    // Age display (optional)
    if (this.showAge && pr > 7) {
      ctx.fillStyle    = 'rgba(200,240,200,0.7)';
      ctx.font         = `${Math.round(pr * 0.38)}px monospace`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('a' + blob.age, cx, cy + pr * 0.45);
    }
  }

  _drawHoverOutline(ctx, blob, W, H) {
    const cx    = blob.x * W, cy = blob.y * H, r = blob.displayRadius + 4;
    const color = STRATEGY_MAP[blob.strategyId] ? STRATEGY_MAP[blob.strategyId].color : '#aaa';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = color; ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
  }

  _drawBattles(ctx, W, H) {
    if (this._battles.length === 0) return;
    ctx.save();
    for (const bat of this._battles) {
      const alpha = bat.ttl / bat.maxTtl;
      const round = bat.moves[bat.roundIdx];
      const { moveA, moveB } = round;

      // Outcome colour
      let lineColor;
      if      (moveA === 'C' && moveB === 'C') lineColor = '#66bb6a';
      else if (moveA === 'D' && moveB === 'D') lineColor = '#ef5350';
      else                                     lineColor = '#ffa726';
      const [lr, lg, lb] = _hexToRgb(lineColor);

      // Arena centre (fixed at match-time positions)
      const mx = bat.arenaX * W, my = bat.arenaY * H;
      const arenaR = 36;

      // Ghost blob positions: orbit the arena center on opposite sides
      const angle = (bat.maxTtl - bat.ttl) * 0.04;
      const orbitR = arenaR * 0.58;
      const gax = mx + Math.cos(angle)          * orbitR;
      const gay = my + Math.sin(angle)          * orbitR;
      const gbx = mx + Math.cos(angle + Math.PI) * orbitR;
      const gby = my + Math.sin(angle + Math.PI) * orbitR;

      ctx.globalAlpha = alpha * 0.9;

      // Arena ring
      ctx.beginPath(); ctx.arc(mx, my, arenaR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${lr},${lg},${lb},0.45)`;
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
      // Inner fill
      ctx.beginPath(); ctx.arc(mx, my, arenaR, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(14,26,14,0.55)`; ctx.fill();

      // Ghost blob A
      const colorA = STRATEGY_MAP[bat.stratA] ? STRATEGY_MAP[bat.stratA].color : '#aaa';
      const colorB = STRATEGY_MAP[bat.stratB] ? STRATEGY_MAP[bat.stratB].color : '#aaa';
      _drawGhostBlob(ctx, gax, gay, 9, colorA, moveA);
      _drawGhostBlob(ctx, gbx, gby, 9, colorB, moveB);

      // Connecting beam between ghosts
      const lineGrd = ctx.createLinearGradient(gax, gay, gbx, gby);
      const [arA] = _hexToRgb(colorA); const [arB] = _hexToRgb(colorB);
      lineGrd.addColorStop(0,   `rgba(${_hexToRgb(colorA).join(',')},0.6)`);
      lineGrd.addColorStop(1,   `rgba(${_hexToRgb(colorB).join(',')},0.6)`);
      ctx.beginPath(); ctx.moveTo(gax, gay); ctx.lineTo(gbx, gby);
      ctx.strokeStyle = lineGrd; ctx.lineWidth = 1.2; ctx.stroke();

      // Centre label
      ctx.globalAlpha = alpha;
      ctx.fillStyle    = lineColor;
      ctx.font         = 'bold 9px monospace';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(moveA + '·' + moveB, mx, my - 4);
      ctx.fillStyle = 'rgba(180,210,160,0.85)';
      ctx.font      = '7px monospace';
      ctx.fillText(`R${bat.roundIdx + 1}/${bat.moves.length}`, mx, my + 5);

      // Score tally (winner arrow)
      const winnerGlyph = bat.totalA > bat.totalB ? '▲▼' : bat.totalB > bat.totalA ? '▼▲' : '=';
      ctx.fillStyle = 'rgba(180,210,160,0.6)';
      ctx.font      = '6px monospace';
      ctx.fillText(bat.totalA.toFixed(0) + ':' + bat.totalB.toFixed(0), mx, my + 13);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _drawDyingBlob(ctx, d, W, H) {
    const progress = d.ttl / d.maxTtl;          // 1.0 → 0.0
    const r = d.r * Math.pow(progress, 0.6);    // shrink (slower at start)
    if (r < 0.5) return;
    const cx = d.x * W, cy = d.y * H;
    const color = STRATEGY_MAP[d.strategyId] ? STRATEGY_MAP[d.strategyId].color : '#888';
    ctx.save();
    ctx.globalAlpha = Math.min(1, progress * 1.6);
    // Outer red dissolution halo
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.6);
    halo.addColorStop(0,   `rgba(255,60,60,${(progress * 0.5).toFixed(2)})`);
    halo.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.6, 0, Math.PI * 2);
    ctx.fillStyle = halo; ctx.fill();
    // Fading strategy-colored body
    const grd = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.05, cx, cy, r);
    grd.addColorStop(0, _lighten(color, 0.3));
    grd.addColorStop(1, _darken(color,  0.5));
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grd; ctx.fill();
    // Cross (✕) death marker
    if (r > 5) {
      ctx.strokeStyle = `rgba(255,255,255,${(progress * 0.9).toFixed(2)})`;
      ctx.lineWidth   = Math.max(1, r * 0.18);
      ctx.lineCap     = 'round';
      const s = r * 0.45;
      ctx.beginPath(); ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx + s, cy + s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + s, cy - s); ctx.lineTo(cx - s, cy + s); ctx.stroke();
    }
    ctx.restore();
  }

  _drawEmpty(ctx, W, H) {
    ctx.fillStyle    = 'rgba(138,171,106,0.25)';
    ctx.font         = '18px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Population Extinct 💀', W / 2, H / 2);
  }

  _onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    // Transform mouse coords into canvas space (account for pan/zoom)
    const mx = (e.clientX - rect.left - this._panX) / this._zoom;
    const my = (e.clientY - rect.top  - this._panY) / this._zoom;
    const W    = this.canvas.width;
    const H    = this.canvas.height;
    let closest = null, minDist = Infinity;

    for (const blob of this.blobs) {
      const cx = blob.x * W, cy = blob.y * H;
      const d  = Math.hypot(mx - cx, my - cy);
      if (d < blob.displayRadius + 6 && d < minDist) { minDist = d; closest = blob; }
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

  destroy() { this.stop(); this._ro.disconnect(); }
}

function _hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function _lighten(hex, amount) {
  const [r, g, b] = _hexToRgb(hex);
  return `rgb(${Math.min(255, r + Math.round(amount * 255))},${Math.min(255, g + Math.round(amount * 255))},${Math.min(255, b + Math.round(amount * 255))})`;
}
function _darken(hex, amount) {
  const [r, g, b] = _hexToRgb(hex);
  return `rgb(${Math.max(0, r - Math.round(amount * 255))},${Math.max(0, g - Math.round(amount * 255))},${Math.max(0, b - Math.round(amount * 255))})`;
}
function _drawMoveChip(ctx, x, y, move, alpha) {
  const isC    = move === 'C';
  const color  = isC ? '#66bb6a' : '#ef5350';
  const radius = 7;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = isC ? 'rgba(40,80,40,0.9)' : 'rgba(80,20,20,0.9)';
  ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle    = color;
  ctx.font         = 'bold 8px monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(move, x, y);
  ctx.restore();
}
function _drawGhostBlob(ctx, cx, cy, r, color, move) {
  const grd = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.05, cx, cy, r);
  grd.addColorStop(0, _lighten(color, 0.3));
  grd.addColorStop(1, _darken(color, 0.4));
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grd; ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
  const isC = move === 'C';
  ctx.fillStyle    = isC ? '#aaffaa' : '#ffaaaa';
  ctx.font         = 'bold 7px monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(move, cx, cy);
}

/* ─── charts.js ──────────────────────────────────────────────────────────── */

const CHART_MAX_POINTS = 200;
const _GRID_COLOR  = 'rgba(46,74,46,0.3)';
const _TEXT_COLOR  = '#8aab6a';
const _FONT_FAMILY = "'Segoe UI', system-ui, sans-serif";

function _baseChartOptions(yLabel) {
  return {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 0 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true, position: 'bottom',
        labels: { color: _TEXT_COLOR, font: { size: 9, family: _FONT_FAMILY }, boxWidth: 10, boxHeight: 10, padding: 8 },
      },
      tooltip: {
        backgroundColor: 'rgba(14,26,14,0.95)', borderColor: 'rgba(46,74,46,0.8)', borderWidth: 1,
        titleColor: '#d4e8c4', bodyColor: '#8aab6a',
        titleFont: { size: 10 }, bodyFont: { size: 9 },
      },
    },
    scales: {
      x: {
        ticks: { color: _TEXT_COLOR, font: { size: 8 }, maxTicksLimit: 8 },
        grid:  { color: _GRID_COLOR },
        title: { display: true, text: 'Generation', color: _TEXT_COLOR, font: { size: 9 } },
      },
      y: {
        ticks: { color: _TEXT_COLOR, font: { size: 8 } },
        grid:  { color: _GRID_COLOR },
        title: { display: !!yLabel, text: yLabel || '', color: _TEXT_COLOR, font: { size: 9 } },
      },
    },
  };
}

function _hexAlpha(hex, a) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

class ChartManager {
  constructor(populationCanvasId, scoresCanvasId, eventsCanvasId) {
    this._popChart    = null;
    this._scoreChart  = null;
    this._eventChart  = null;
    this._popCanvas   = document.getElementById(populationCanvasId);
    this._scoreCanvas = document.getElementById(scoresCanvasId);
    this._eventCanvas = document.getElementById(eventsCanvasId);
    this._history     = [];
    this._eventBuffer = [];
  }

  init() {
    this._destroyAll();
    this._initPopChart();
    this._initScoreChart();
    this._initEventChart();
  }

  update(snap, genData) {
    this._history.push(snap);
    this._eventBuffer.push({
      generation: snap.generation,
      births:     genData.births.length,
      deaths:     genData.deaths.length,
      mutations:  genData.mutations.length,
    });
    this._updatePopChart();
    this._updateScoreChart();
    this._updateEventChart();
  }

  reset() { this._history = []; this._eventBuffer = []; this.init(); }

  _initPopChart() {
    if (!this._popCanvas) return;
    const datasets = STRATEGIES.map(s => ({
      label: s.name, data: [],
      backgroundColor: _hexAlpha(s.color, 0.55), borderColor: s.color,
      borderWidth: 1.5, fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 3,
    }));
    const opts = _baseChartOptions('Count');
    opts.scales.y.stacked = true; opts.scales.y.min = 0;
    this._popChart = new Chart(this._popCanvas, { type: 'line', data: { labels: [], datasets }, options: opts });
  }

  _updatePopChart() {
    if (!this._popChart) return;
    const history = this._downsample(this._history, CHART_MAX_POINTS);
    this._popChart.data.labels = history.map(h => h.generation);
    STRATEGIES.forEach((s, i) => { this._popChart.data.datasets[i].data = history.map(h => h.counts[s.id] || 0); });
    this._popChart.update('none');
  }

  _initScoreChart() {
    if (!this._scoreCanvas) return;
    const datasets = STRATEGIES.map(s => ({
      label: s.name, data: [],
      borderColor: s.color, backgroundColor: _hexAlpha(s.color, 0.1),
      borderWidth: 1.5, fill: false, tension: 0.3, pointRadius: 0, pointHoverRadius: 3,
    }));
    this._scoreChart = new Chart(this._scoreCanvas, { type: 'line', data: { labels: [], datasets }, options: _baseChartOptions('Avg Score') });
  }

  _updateScoreChart() {
    if (!this._scoreChart) return;
    const history = this._downsample(this._history, CHART_MAX_POINTS);
    this._scoreChart.data.labels = history.map(h => h.generation);
    STRATEGIES.forEach((s, i) => { this._scoreChart.data.datasets[i].data = history.map(h => +(h.avgScores[s.id] || 0).toFixed(3)); });
    this._scoreChart.update('none');
  }

  _initEventChart() {
    if (!this._eventCanvas) return;
    this._eventChart = new Chart(this._eventCanvas, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          { label: 'Births',    data: [], backgroundColor: _hexAlpha('#4caf50', 0.7), borderWidth: 0 },
          { label: 'Deaths',    data: [], backgroundColor: _hexAlpha('#ef5350', 0.7), borderWidth: 0 },
          { label: 'Mutations', data: [], backgroundColor: _hexAlpha('#f59e0b', 0.7), borderWidth: 0 },
        ],
      },
      options: (() => {
        const o = _baseChartOptions('Count');
        o.scales.x.stacked = true; o.scales.y.stacked = true; o.scales.y.min = 0;
        return o;
      })(),
    });
  }

  _updateEventChart() {
    if (!this._eventChart) return;
    const buf = this._downsample(this._eventBuffer, CHART_MAX_POINTS);
    this._eventChart.data.labels            = buf.map(e => e.generation);
    this._eventChart.data.datasets[0].data = buf.map(e => e.births);
    this._eventChart.data.datasets[1].data = buf.map(e => e.deaths);
    this._eventChart.data.datasets[2].data = buf.map(e => e.mutations);
    this._eventChart.update('none');
  }

  _downsample(arr, maxPoints) {
    if (arr.length <= maxPoints) return arr;
    const step = arr.length / maxPoints;
    const result = [];
    for (let i = 0; i < maxPoints; i++) result.push(arr[Math.round(i * step)]);
    return result;
  }

  _destroyAll() {
    [this._popChart, this._scoreChart, this._eventChart].forEach(c => { if (c) c.destroy(); });
    this._popChart = null; this._scoreChart = null; this._eventChart = null;
  }

  destroy() { this._destroyAll(); }
}

/* ─── main.js ────────────────────────────────────────────────────────────── */

(function () {
  const $ = (id) => document.getElementById(id);

  const ui = {
    speed:          $('sim-speed'),
    arenaHeight:    $('arena-height'),
    maxGen:         $('max-gen'),
    maxPop:         $('max-pop'),
    initPop:        $('init-pop'),
    initScore:      $('init-score'),
    metabolismCost: $('metabolism-cost'),
    deathThresh:    $('death-thresh'),
    reproThresh:    $('repro-thresh'),
    mutationRate:   $('mutation-rate'),
    roundsPerMatch: $('rounds-per-match'),
    matchesPerGen:  $('matches-per-gen'),
    memoryLen:      $('memory-len'),
    neighborProb:   $('neighbor-prob'),
    misunderstandRate: $('misunderstand-rate'),
    maxAge:         $('max-age'),
    showAge:        $('show-age'),
    payoffT:        $('payoff-T'),
    payoffR:        $('payoff-R'),
    payoffP:        $('payoff-P'),
    payoffS:        $('payoff-S'),

    valSpeed:       $('val-speed'),
    valArenaHeight: $('val-arena-height'),
    valMaxGen:      $('val-max-gen'),
    valMaxPop:      $('val-max-pop'),
    valInitPop:     $('val-init-pop'),
    valInitScore:   $('val-init-score'),
    valMetabolism:  $('val-metabolism'),
    valDeathThresh: $('val-death-thresh'),
    valReproThresh: $('val-repro-thresh'),
    valMutation:    $('val-mutation-rate'),
    valRounds:      $('val-rounds'),
    valMatches:     $('val-matches'),
    valMemory:      $('val-memory'),
    valNeighbor:    $('val-neighbor'),
    valMisunderstand: $('val-misunderstand'),
    valMaxAge:      $('val-max-age'),

    btnStart:   $('btn-start'),
    btnPause:   $('btn-pause'),
    btnStep:    $('btn-step'),
    btnRestart: $('btn-restart'),
    btnReset:   $('btn-reset'),
    btnZoomIn:  $('btn-zoom-in'),
    btnZoomOut: $('btn-zoom-out'),
    btnPanReset:$('btn-pan-reset'),
    endModal:   $('end-modal'),
    btnCloseEnd:$('btn-close-end'),

    statGen:       $('stat-gen'),
    statPop:       $('stat-pop'),
    statBirths:    $('stat-births'),
    statDeaths:    $('stat-deaths'),
    statMutations: $('stat-mutations'),
    statDominant:  $('stat-dominant'),

    canvas:      $('sim-canvas'),
    canvasWrapper: $('canvas-wrapper'),
    overlay:     $('canvas-overlay'),
    tooltip:     $('blob-tooltip'),
    legend:      $('legend'),
    logEntries:  $('log-entries'),
    stratTbody:  $('strategy-tbody'),
    stratTotal:  $('strat-total'),
    stratSliders:$('strategy-sliders'),
    tabBtns:     document.querySelectorAll('.tab-btn'),
  };

  let sim      = null;
  let renderer = null;
  let charts   = null;
  let strategyWeights = {};

  // ── Build strategy sliders ──────────────────────────────────────────────────
  function buildStrategySliders() {
    strategyWeights = {};
    ui.stratSliders.innerHTML = '';
    for (const s of STRATEGIES) {
      strategyWeights[s.id] = s.weight;
      const row = document.createElement('div');
      row.className = 'strat-row';
      row.innerHTML = `
        <span class="strat-dot" style="background:${s.color};color:${s.color}"></span>
        <label title="${s.desc}">${s.name}</label>
        <input type="range" min="0" max="100" value="${s.weight}" step="1" data-id="${s.id}" />
        <span class="val strat-val" data-id="${s.id}">${s.weight}</span>
      `;
      ui.stratSliders.appendChild(row);
      row.querySelector('input').addEventListener('input', (e) => {
        const id  = e.target.dataset.id;
        const val = parseInt(e.target.value, 10);
        strategyWeights[id] = val;
        row.querySelector(`.strat-val[data-id="${id}"]`).textContent = val;
        updateStratTotal();
      });
    }
    updateStratTotal();
  }

  function updateStratTotal() {
    const total = Object.values(strategyWeights).reduce((a, b) => a + b, 0);
    ui.stratTotal.textContent = total;
    ui.stratTotal.style.color = total === 100 ? 'var(--green-400)' : total > 100 ? 'var(--red)' : 'var(--amber)';
  }

  function buildLegend() {
    ui.legend.innerHTML = '';
    for (const s of STRATEGIES) {
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `<div class="legend-dot" style="background:${s.color}"></div><span>${s.name}</span>`;
      ui.legend.appendChild(item);
    }
  }

  // ── Sliders ─────────────────────────────────────────────────────────────────
  function bindSlider(inputEl, displayEl, transform) {
    if (!inputEl || !displayEl) return;
    transform = transform || function (v) { return v; };
    const update = function () { displayEl.textContent = transform(inputEl.value); };
    inputEl.addEventListener('input', update);
    update();
  }

  function initSliders() {
    bindSlider(ui.speed,          ui.valSpeed,       function(v){ return parseFloat(v).toFixed(1); });
    bindSlider(ui.maxGen,         ui.valMaxGen,      function(v){ return v; });
    bindSlider(ui.maxPop,         ui.valMaxPop,      function(v){ return v; });
    bindSlider(ui.initPop,        ui.valInitPop,     function(v){ return v; });
    bindSlider(ui.initScore,      ui.valInitScore,   function(v){ return parseFloat(v).toFixed(1); });
    bindSlider(ui.metabolismCost, ui.valMetabolism,  function(v){ return parseFloat(v).toFixed(1); });
    bindSlider(ui.deathThresh,    ui.valDeathThresh, function(v){ return parseFloat(v).toFixed(1); });
    bindSlider(ui.reproThresh,    ui.valReproThresh, function(v){ return parseFloat(v).toFixed(1); });
    bindSlider(ui.mutationRate,   ui.valMutation,    function(v){ return v; });
    bindSlider(ui.roundsPerMatch, ui.valRounds,      function(v){ return v; });
    bindSlider(ui.matchesPerGen,  ui.valMatches,     function(v){ return v; });
    bindSlider(ui.memoryLen,      ui.valMemory,      function(v){ return v; });
    bindSlider(ui.neighborProb,   ui.valNeighbor,    function(v){ return v; });
    bindSlider(ui.misunderstandRate, ui.valMisunderstand, function(v){ return v; });
    bindSlider(ui.maxAge,         ui.valMaxAge,      function(v){ return parseInt(v, 10) === 0 ? '∞' : v; });
    // Arena height — also sets the wrapper's CSS height so ResizeObserver fires
    bindSlider(ui.arenaHeight,    ui.valArenaHeight, function(v){ return v; });
    if (ui.arenaHeight) {
      const applyHeight = function() {
        if (ui.canvasWrapper) {
          ui.canvasWrapper.style.height = ui.arenaHeight.value + 'px';
          ui.canvasWrapper.style.flex = 'none';
        }
      };
      ui.arenaHeight.addEventListener('input', applyHeight);
      // Apply initial value
      applyHeight();
    }
  }

  // ── Read params ─────────────────────────────────────────────────────────────
  function readParams() {
    return {
      speed:               parseFloat(ui.speed.value),
      maxGenerations:      parseInt(ui.maxGen.value, 10),
      maxPop:              parseInt(ui.maxPop.value, 10),
      initialPop:          parseInt(ui.initPop.value, 10),
      initScore:           parseFloat(ui.initScore.value),
      metabolismCost:      parseFloat(ui.metabolismCost.value),
      deathThreshold:      parseFloat(ui.deathThresh.value),
      reproThreshold:      parseFloat(ui.reproThresh.value),
      mutationRate:        parseInt(ui.mutationRate.value, 10) / 100,
      roundsPerMatch:      parseInt(ui.roundsPerMatch.value, 10),
      matchesPerGen:       parseInt(ui.matchesPerGen.value, 10),
      memoryLen:           parseInt(ui.memoryLen.value, 10),
      neighborProb:        parseInt(ui.neighborProb.value, 10) / 100,
      misunderstandingRate:parseInt(ui.misunderstandRate.value, 10) / 100,
      maxAge:              parseInt(ui.maxAge.value, 10),
      payoff: {
        T: parseFloat(ui.payoffT.value),
        R: parseFloat(ui.payoffR.value),
        P: parseFloat(ui.payoffP.value),
        S: parseFloat(ui.payoffS.value),
      },
      strategyWeights: Object.assign({}, strategyWeights),
    };
  }

  // ── Reset defaults ──────────────────────────────────────────────────────────
  function resetToDefaults() {
    const p = DEFAULT_PARAMS;
    ui.speed.value          = p.speed;
    ui.maxGen.value         = p.maxGenerations;   // 1000
    ui.maxPop.value         = p.maxPop;
    ui.initPop.value        = p.initialPop;
    ui.initScore.value      = p.initScore;
    ui.metabolismCost.value = p.metabolismCost;
    ui.deathThresh.value    = p.deathThreshold;
    ui.reproThresh.value    = p.reproThreshold;
    ui.mutationRate.value   = p.mutationRate * 100;
    ui.roundsPerMatch.value = p.roundsPerMatch;
    ui.matchesPerGen.value  = p.matchesPerGen;
    ui.memoryLen.value      = p.memoryLen;
    ui.neighborProb.value   = p.neighborProb * 100;
    ui.misunderstandRate.value = p.misunderstandingRate * 100;
    ui.maxAge.value         = p.maxAge;
    ui.payoffT.value        = p.payoff.T;
    ui.payoffR.value        = p.payoff.R;
    ui.payoffP.value        = p.payoff.P;
    ui.payoffS.value        = p.payoff.S;
    ['sim-speed','arena-height','max-gen','max-pop','init-pop','init-score','metabolism-cost','death-thresh','repro-thresh',
     'mutation-rate','rounds-per-match','matches-per-gen','memory-len','neighbor-prob','misunderstand-rate','max-age'].forEach(function(id) {
      var el = $(id); if (el) el.dispatchEvent(new Event('input'));
    });
    for (const s of STRATEGIES) {
      strategyWeights[s.id] = s.weight;
      const inp = ui.stratSliders.querySelector(`input[data-id="${s.id}"]`);
      const val = ui.stratSliders.querySelector(`.strat-val[data-id="${s.id}"]`);
      if (inp) inp.value = s.weight;
      if (val) val.textContent = s.weight;
    }
    updateStratTotal();
  }

  // ── Simulation lifecycle ────────────────────────────────────────────────────
  function createSim() {
    if (sim) sim.pause();
    if (!renderer) renderer = new Renderer(ui.canvas, ui.tooltip);
    if (!charts)   { charts = new ChartManager('chart-population', 'chart-scores', 'chart-events'); charts.init(); }

    sim = new Simulation(readParams());

    sim.on('init', function(data) {
      renderer.update(data.blobs, []);
      renderer.start();
      charts.reset();
      updateStatBar(0, data.blobs.length, 0, 0, 0, null);
      updateStrategyTable(sim.getStrategyStats());
      ui.overlay.classList.add('hidden');
      setButtonState('running');
    });

    sim.on('generation', function(data) {
      // Live-update params the user can tweak mid-run
      const p = readParams();
      sim.params.speed               = p.speed;
      sim.params.maxGenerations      = p.maxGenerations;
      sim.params.maxPop              = p.maxPop;
      sim.params.metabolismCost      = p.metabolismCost;
      sim.params.deathThreshold      = p.deathThreshold;
      sim.params.reproThreshold      = p.reproThreshold;
      sim.params.mutationRate        = p.mutationRate;
      sim.params.roundsPerMatch      = p.roundsPerMatch;
      sim.params.matchesPerGen       = p.matchesPerGen;
      sim.params.memoryLen           = p.memoryLen;
      sim.params.neighborProb        = p.neighborProb;
      sim.params.misunderstandingRate= p.misunderstandingRate;
      sim.params.maxAge              = p.maxAge;
      sim.params.payoff              = p.payoff;
      
      if (renderer) renderer.showAge = ui.showAge ? ui.showAge.checked : false;
      renderer.update(data.blobs, data.births, data.deaths, data.matchups || []);
      charts.update(data.snapshot, { births: data.births, deaths: data.deaths, mutations: data.mutations });
      updateStatBar(data.generation, data.blobs.length, data.totalBirths, data.totalDeaths, data.totalMutations, sim.getDominant());
      updateStrategyTable(sim.getStrategyStats());
    });

    sim.on('log', function(entry) { appendLog(entry); });

    sim.on('finished', function(data) {
      appendLog({ cssClass: 'info', message: '✅ Simulation ended at generation ' + data.generation + '.', generation: data.generation });
      setButtonState('finished');
      showEndModal(sim);
    });

    sim.on('stateChange', function(data) {
      ui.btnPause.textContent = data.running ? '⏸ Pause' : '▶ Resume';
    });

    sim.init();
  }

  function startSim() {
    if (!sim) createSim();
    sim.start();
    setButtonState('running');
  }

  function pauseSim() {
    if (!sim) return;
    if (sim.isRunning) { sim.pause(); setButtonState('paused'); }
    else               { sim.start(); setButtonState('running'); }
  }

  function stepSim() {
    if (!sim) { createSim(); setButtonState('paused'); return; }
    if (sim.isRunning) sim.pause();
    sim.step();
    if (renderer) renderer.update(sim.blobs, []);
    if (charts && sim.history.length > 0) {
      const snap = sim.history[sim.history.length - 1];
      charts.update(snap, { births: [], deaths: [], mutations: [] });
    }
    updateStatBar(sim.generation, sim.blobs.length, sim.totalBirths, sim.totalDeaths, sim.totalMutations, sim.getDominant());
    updateStrategyTable(sim.getStrategyStats());
    setButtonState('paused');
  }

  function restartSim() { createSim(); startSim(); }

  // ── UI helpers ──────────────────────────────────────────────────────────────
  function setButtonState(state) {
    ui.btnStart.disabled    = (state === 'running');
    ui.btnPause.disabled    = (state === 'idle' || state === 'finished');
    ui.btnStep.disabled     = (state === 'running' || state === 'finished');
    ui.btnPause.textContent = (state === 'paused') ? '▶ Resume' : '⏸ Pause';
  }

  function updateStatBar(gen, pop, births, deaths, mutations, dominant) {
    ui.statGen.textContent       = gen;
    ui.statPop.textContent       = pop;
    ui.statBirths.textContent    = births;
    ui.statDeaths.textContent    = deaths;
    ui.statMutations.textContent = mutations;
    ui.statDominant.textContent  = dominant ? dominant.name : '—';
    if (dominant) ui.statDominant.style.color = dominant.color;
  }

  function updateStrategyTable(stats) {
    ui.stratTbody.innerHTML = stats.filter(function(s){ return s.count > 0; }).map(function(s) {
      return '<tr>' +
        '<td><span class="strat-name">' +
          '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + s.color + ';margin-right:4px;"></span>' +
          s.name + '</span></td>' +
        '<td>' + s.count + '</td>' +
        '<td>' + s.avgScore.toFixed(2) + '</td>' +
        '<td>' + s.wins + '</td>' +
        '</tr>';
    }).join('');
  }

  function appendLog(entry) {
    const div    = document.createElement('div');
    div.className = 'log-entry ' + (entry.cssClass || 'info');
    div.innerHTML  = '<span class="log-gen">G' + entry.generation + '</span>' + entry.message;
    ui.logEntries.prepend(div);
    while (ui.logEntries.children.length > 100) ui.logEntries.removeChild(ui.logEntries.lastChild);
  }

  // ── End-of-simulation modal ─────────────────────────────────────────────────
  function showEndModal(simRef) {
    if (!ui.endModal) return;
    ui.endModal.classList.remove('hidden');
    var stats = simRef.getStrategyStats ? simRef.getStrategyStats() : [];
    var gen   = simRef.generation || 0;
    var summaryEl = document.getElementById('end-summary');
    if (summaryEl) summaryEl.textContent = 'Final populations after ' + gen + ' generation(s).';
    var canvas = document.getElementById('end-chart');
    if (!canvas) return;
    var alive = stats.filter(function(s){ return s.count > 0; }).sort(function(a,b){ return b.count - a.count; });
    if (window._endChart) { window._endChart.destroy(); window._endChart = null; }
    window._endChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: alive.map(function(s){ return s.name; }),
        datasets: [{
          label: 'Population',
          data: alive.map(function(s){ return s.count; }),
          backgroundColor: alive.map(function(s){ return s.color + 'aa'; }),
          borderColor:     alive.map(function(s){ return s.color; }),
          borderWidth: 1.5,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
      },
    });
  }

  // ── Chart tabs ──────────────────────────────────────────────────────────────
  function initTabs() {
    ui.tabBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        ui.tabBtns.forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        [$('tab-population'), $('tab-scores'), $('tab-events')].forEach(function(el){ el.classList.add('hidden'); });
        $('tab-' + tab).classList.remove('hidden');
      });
    });
  }

  // ── Wire buttons ─────────────────────────────────────────────────────────────
  ui.btnStart.addEventListener('click',   startSim);
  ui.btnPause.addEventListener('click',   pauseSim);
  ui.btnStep.addEventListener('click',    stepSim);
  ui.btnRestart.addEventListener('click', restartSim);
  ui.btnReset.addEventListener('click',   resetToDefaults);

  if (ui.btnZoomIn)   ui.btnZoomIn.addEventListener('click',   function(){ if (renderer) { renderer._zoom = Math.min(10, renderer._zoom * 1.3); } });
  if (ui.btnZoomOut)  ui.btnZoomOut.addEventListener('click',  function(){ if (renderer) { renderer._zoom = Math.max(0.15, renderer._zoom / 1.3); } });
  if (ui.btnPanReset) ui.btnPanReset.addEventListener('click', function(){ if (renderer) renderer.resetView(); });
  if (ui.btnCloseEnd) ui.btnCloseEnd.addEventListener('click', function(){ if (ui.endModal) ui.endModal.classList.add('hidden'); });
  if (ui.showAge)     ui.showAge.addEventListener('change',    function(){ if (renderer) renderer.showAge = ui.showAge.checked; });

  // ── Boot ─────────────────────────────────────────────────────────────────────
  buildStrategySliders();
  buildLegend();
  initSliders();
  initTabs();
  setButtonState('idle');
  ui.btnStep.disabled = false;

})(); // end IIFE
