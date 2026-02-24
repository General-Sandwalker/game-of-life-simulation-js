/**
 * main.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Entry point — wires UI controls, Simulation, Renderer, and ChartManager.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Simulation, DEFAULT_PARAMS } from './simulation.js';
import { Renderer }                   from './renderer.js';
import { ChartManager }               from './charts.js';
import { STRATEGIES }                 from './strategies.js';

// ══ Gather UI elements ════════════════════════════════════════════════════════

const $ = (id) => document.getElementById(id);

const ui = {
  // Controls
  speed:         $('sim-speed'),
  maxGen:        $('max-gen'),
  maxPop:        $('max-pop'),
  initPop:       $('init-pop'),
  initScore:     $('init-score'),
  deathThresh:   $('death-thresh'),
  reproThresh:   $('repro-thresh'),
  mutationRate:  $('mutation-rate'),
  roundsPerMatch:$('rounds-per-match'),
  matchesPerGen: $('matches-per-gen'),
  memoryLen:     $('memory-len'),
  payoffT:       $('payoff-T'),
  payoffR:       $('payoff-R'),
  payoffP:       $('payoff-P'),
  payoffS:       $('payoff-S'),

  // Value displays
  valSpeed:      $('val-speed'),
  valMaxGen:     $('val-max-gen'),
  valMaxPop:     $('val-max-pop'),
  valInitPop:    $('val-init-pop'),
  valInitScore:  $('val-init-score'),
  valDeathThresh:$('val-death-thresh'),
  valReproThresh:$('val-repro-thresh'),
  valMutation:   $('val-mutation-rate'),
  valRounds:     $('val-rounds'),
  valMatches:    $('val-matches'),
  valMemory:     $('val-memory'),

  // Action buttons
  btnStart:   $('btn-start'),
  btnPause:   $('btn-pause'),
  btnStep:    $('btn-step'),
  btnRestart: $('btn-restart'),
  btnReset:   $('btn-reset'),

  // Stats
  statGen:       $('stat-gen'),
  statPop:       $('stat-pop'),
  statBirths:    $('stat-births'),
  statDeaths:    $('stat-deaths'),
  statMutations: $('stat-mutations'),
  statDominant:  $('stat-dominant'),

  // Canvas / overlay
  canvas:        $('sim-canvas'),
  overlay:       $('canvas-overlay'),
  tooltip:       $('blob-tooltip'),

  // Legend
  legend:        $('legend'),

  // Log & table
  logEntries:    $('log-entries'),
  stratTbody:    $('strategy-tbody'),
  stratTotal:    $('strat-total'),

  // Strategy sliders container
  stratSliders:  $('strategy-sliders'),

  // Chart tabs
  tabBtns:       document.querySelectorAll('.tab-btn'),
  tabPop:        $('tab-population'),
  tabScores:     $('tab-scores'),
  tabEvents:     $('tab-events'),
};

// ══ State ════════════════════════════════════════════════════════════════════

let sim       = null;
let renderer  = null;
let charts    = null;
let strategyWeights = {}; // strategy id → weight (number 0–100)

// ══ Initialise UI ════════════════════════════════════════════════════════════

function buildStrategySliders() {
  strategyWeights = {};
  ui.stratSliders.innerHTML = '';

  for (const s of STRATEGIES) {
    strategyWeights[s.id] = s.weight;

    const row = document.createElement('div');
    row.className = 'strat-row';
    row.innerHTML = `
      <span class="strat-dot" style="background:${s.color}; color:${s.color}"></span>
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
  ui.stratTotal.style.color = (total === 100) ? 'var(--green-400)'
                            : (total  >  100) ? 'var(--red)'
                            :                   'var(--amber)';
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

// ─── Slider live-value binding ────────────────────────────────────────────────

function bindSlider(inputEl, displayEl, transform = v => v) {
  const update = () => { displayEl.textContent = transform(inputEl.value); };
  inputEl.addEventListener('input', update);
  update();
}

function initSliders() {
  bindSlider(ui.speed,          ui.valSpeed,       v => v);
  bindSlider(ui.maxGen,         ui.valMaxGen,      v => v);
  bindSlider(ui.maxPop,         ui.valMaxPop,      v => v);
  bindSlider(ui.initPop,        ui.valInitPop,     v => v);
  bindSlider(ui.initScore,      ui.valInitScore,   v => parseFloat(v).toFixed(1));
  bindSlider(ui.deathThresh,    ui.valDeathThresh, v => parseFloat(v).toFixed(2));
  bindSlider(ui.reproThresh,    ui.valReproThresh, v => parseFloat(v).toFixed(1));
  bindSlider(ui.mutationRate,   ui.valMutation,    v => v);
  bindSlider(ui.roundsPerMatch, ui.valRounds,      v => v);
  bindSlider(ui.matchesPerGen,  ui.valMatches,     v => v);
  bindSlider(ui.memoryLen,      ui.valMemory,      v => v);
}

// ─── Read current params from UI ─────────────────────────────────────────────

function readParams() {
  return {
    speed:          parseInt(ui.speed.value, 10),
    maxGenerations: parseInt(ui.maxGen.value, 10),
    maxPop:         parseInt(ui.maxPop.value, 10),
    initialPop:     parseInt(ui.initPop.value, 10),
    initScore:      parseFloat(ui.initScore.value),
    deathThreshold: parseFloat(ui.deathThresh.value),
    reproThreshold: parseFloat(ui.reproThresh.value),
    mutationRate:   parseInt(ui.mutationRate.value, 10) / 100,
    roundsPerMatch: parseInt(ui.roundsPerMatch.value, 10),
    matchesPerGen:  parseInt(ui.matchesPerGen.value, 10),
    memoryLen:      parseInt(ui.memoryLen.value, 10),
    payoff: {
      T: parseFloat(ui.payoffT.value),
      R: parseFloat(ui.payoffR.value),
      P: parseFloat(ui.payoffP.value),
      S: parseFloat(ui.payoffS.value),
    },
    strategyWeights: { ...strategyWeights },
  };
}

// ─── Reset controls to defaults ────────────────────────────────────────────────

function resetToDefaults() {
  const p = DEFAULT_PARAMS;
  ui.speed.value          = p.speed;
  ui.maxGen.value         = p.maxGenerations;
  ui.maxPop.value         = p.maxPop;
  ui.initPop.value        = p.initialPop;
  ui.initScore.value      = p.initScore;
  ui.deathThresh.value    = p.deathThreshold;
  ui.reproThresh.value    = p.reproThreshold;
  ui.mutationRate.value   = p.mutationRate * 100;
  ui.roundsPerMatch.value = p.roundsPerMatch;
  ui.matchesPerGen.value  = p.matchesPerGen;
  ui.memoryLen.value      = p.memoryLen;
  ui.payoffT.value        = p.payoff.T;
  ui.payoffR.value        = p.payoff.R;
  ui.payoffP.value        = p.payoff.P;
  ui.payoffS.value        = p.payoff.S;
  // Trigger value display updates
  ['speed','max-gen','max-pop','init-pop','init-score','death-thresh','repro-thresh',
   'mutation-rate','rounds-per-match','matches-per-gen','memory-len'].forEach(id => {
    $( id).dispatchEvent(new Event('input'));
  });

  // Reset strategy weights
  for (const s of STRATEGIES) {
    strategyWeights[s.id] = s.weight;
    const inp = ui.stratSliders.querySelector(`input[data-id="${s.id}"]`);
    const val = ui.stratSliders.querySelector(`.strat-val[data-id="${s.id}"]`);
    if (inp) inp.value  = s.weight;
    if (val) val.textContent = s.weight;
  }
  updateStratTotal();
}

// ══ Simulation lifecycle ═════════════════════════════════════════════════════

function createSim() {
  if (sim) {
    sim.pause();
    sim = null;
  }
  if (renderer) { renderer.stop(); }
  if (!renderer) {
    renderer = new Renderer(ui.canvas, ui.tooltip);
  }
  if (!charts) {
    charts = new ChartManager('chart-population', 'chart-scores', 'chart-events');
    charts.init();
  }

  sim = new Simulation(readParams());

  // ── Wire events ─────────────────────────────────────────────────────────────

  sim.on('init', ({ blobs }) => {
    renderer.update(blobs, []);
    renderer.start();
    charts.reset();
    updateStatBar(0, blobs.length, 0, 0, 0, null);
    updateStrategyTable(sim.getStrategyStats());
    ui.overlay.classList.add('hidden');
    setButtonState('running');
  });

  sim.on('generation', (data) => {
    const { generation, blobs, snapshot, births, deaths, mutations,
            totalBirths, totalDeaths, totalMutations } = data;

    // Update speed live (user may change slider during run)
    sim.params.speed = parseInt(ui.speed.value, 10);

    renderer.update(blobs, births);
    charts.update(snapshot, { births, deaths, mutations, generation });
    updateStatBar(generation, blobs.length, totalBirths, totalDeaths, totalMutations, sim.getDominant());
    updateStrategyTable(sim.getStrategyStats());
  });

  sim.on('log', (entry) => appendLog(entry));

  sim.on('finished', ({ generation }) => {
    appendLog({ cssClass: 'info', message: `✅ Simulation ended at generation ${generation}.`, generation });
    setButtonState('finished');
  });

  sim.on('stateChange', ({ running }) => {
    ui.btnPause.textContent = running ? '⏸ Pause' : '▶ Resume';
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
  if (sim.isRunning) {
    sim.pause();
    setButtonState('paused');
  } else {
    sim.start();
    setButtonState('running');
  }
}

function stepSim() {
  if (!sim) createSim();
  if (sim.isRunning) sim.pause();
  sim.step();
  setButtonState('paused');
}

function restartSim() {
  createSim();
  startSim();
}

// ══ UI Updates ═══════════════════════════════════════════════════════════════

function setButtonState(state) {
  // state: 'idle' | 'running' | 'paused' | 'finished'
  ui.btnStart.disabled   = (state === 'running');
  ui.btnPause.disabled   = (state === 'idle' || state === 'finished');
  ui.btnStep.disabled    = (state === 'running' || state === 'finished');
  ui.btnPause.textContent = (state === 'paused') ? '▶ Resume' : '⏸ Pause';
}

function updateStatBar(gen, pop, births, deaths, mutations, dominant) {
  ui.statGen.textContent       = gen;
  ui.statPop.textContent       = pop;
  ui.statBirths.textContent    = births;
  ui.statDeaths.textContent    = deaths;
  ui.statMutations.textContent = mutations;
  ui.statDominant.textContent  = dominant ? dominant.name : '—';
  if (dominant) {
    ui.statDominant.style.color = dominant.color;
  }
}

function updateStrategyTable(stats) {
  ui.stratTbody.innerHTML = stats
    .filter(s => s.count > 0)
    .map(s => `
      <tr>
        <td><span class="strat-name">
          <span class="legend-dot" style="background:${s.color};display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;"></span>
          ${s.name}
        </span></td>
        <td>${s.count}</td>
        <td>${s.avgScore.toFixed(2)}</td>
        <td>${s.wins}</td>
      </tr>
    `).join('');
}

function appendLog(entry) {
  const div = document.createElement('div');
  div.className = `log-entry ${entry.cssClass}`;
  div.innerHTML = `<span class="log-gen">G${entry.generation}</span>${entry.message}`;
  ui.logEntries.prepend(div);
  // Cap at 100 entries in DOM
  while (ui.logEntries.children.length > 100) {
    ui.logEntries.removeChild(ui.logEntries.lastChild);
  }
}

// ─── Chart tab switching ──────────────────────────────────────────────────────

function initTabs() {
  ui.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      ui.tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      [$('tab-population'), $('tab-scores'), $('tab-events')].forEach(el => el.classList.add('hidden'));
      $(`tab-${tab}`).classList.remove('hidden');
    });
  });
}

// ══ Wire buttons ═════════════════════════════════════════════════════════════

ui.btnStart.addEventListener('click',   startSim);
ui.btnPause.addEventListener('click',   pauseSim);
ui.btnStep.addEventListener('click',    stepSim);
ui.btnRestart.addEventListener('click', restartSim);
ui.btnReset.addEventListener('click',   resetToDefaults);

// ══ Bootstrap ════════════════════════════════════════════════════════════════

buildStrategySliders();
buildLegend();
initSliders();
initTabs();
setButtonState('idle');

// Allow stepping before first start
ui.btnStep.disabled = false;
