/**
 * charts.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Chart management using Chart.js.
 *
 * Three charts:
 *   1. Population — stacked area showing each strategy's count over time.
 *   2. Scores     — line chart showing average score per strategy over time.
 *   3. Events     — bar chart showing births, deaths, mutations per generation.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { STRATEGIES } from './strategies.js';

const CHART_MAX_POINTS = 200; // downsample history to this many points

// ─── Chart theme helpers ──────────────────────────────────────────────────────

const GRID_COLOR  = 'rgba(46,74,46,0.3)';
const TEXT_COLOR  = '#8aab6a';
const FONT_FAMILY = "'Segoe UI', system-ui, sans-serif";

function baseChartOptions(yLabel = '') {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          color:    TEXT_COLOR,
          font:     { size: 9, family: FONT_FAMILY },
          boxWidth: 10, boxHeight: 10,
          padding:  8,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(14,26,14,0.95)',
        borderColor:     'rgba(46,74,46,0.8)',
        borderWidth:     1,
        titleColor:      '#d4e8c4',
        bodyColor:       '#8aab6a',
        titleFont:       { size: 10 },
        bodyFont:        { size: 9 },
      },
    },
    scales: {
      x: {
        ticks: { color: TEXT_COLOR, font: { size: 8 }, maxTicksLimit: 8 },
        grid:  { color: GRID_COLOR },
        title: { display: true, text: 'Generation', color: TEXT_COLOR, font: { size: 9 } },
      },
      y: {
        ticks: { color: TEXT_COLOR, font: { size: 8 } },
        grid:  { color: GRID_COLOR },
        title: { display: !!yLabel, text: yLabel, color: TEXT_COLOR, font: { size: 9 } },
      },
    },
  };
}

function hexAlpha(hex, a) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8)  & 255;
  const b =  n        & 255;
  return `rgba(${r},${g},${b},${a})`;
}

// ─── ChartManager class ───────────────────────────────────────────────────────

export class ChartManager {
  /**
   * @param {string} populationCanvasId
   * @param {string} scoresCanvasId
   * @param {string} eventsCanvasId
   */
  constructor(populationCanvasId, scoresCanvasId, eventsCanvasId) {
    this._popChart    = null;
    this._scoreChart  = null;
    this._eventChart  = null;

    this._popCanvas   = document.getElementById(populationCanvasId);
    this._scoreCanvas = document.getElementById(scoresCanvasId);
    this._eventCanvas = document.getElementById(eventsCanvasId);

    this._history     = [];   // copied from simulation history snapshots
    this._eventBuffer = [];   // { generation, births, deaths, mutations }
  }

  // ─── Initialise charts ───────────────────────────────────────────────────────

  init() {
    this._destroyAll();
    this._initPopChart();
    this._initScoreChart();
    this._initEventChart();
  }

  // ─── Update from simulation data ─────────────────────────────────────────────

  /**
   * Called each generation with the latest snapshot.
   * @param {object} snap     - GenerationSnapshot from simulation
   * @param {object} genData  - { births, deaths, mutations, generation }
   */
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

  /** Reset all charts to empty state. */
  reset() {
    this._history     = [];
    this._eventBuffer = [];
    this.init();
  }

  // ─── Population chart ────────────────────────────────────────────────────────

  _initPopChart() {
    if (!this._popCanvas) return;
    const datasets = STRATEGIES.map(s => ({
      label:           s.name,
      data:            [],
      backgroundColor: hexAlpha(s.color, 0.55),
      borderColor:     s.color,
      borderWidth:     1.5,
      fill:            true,
      tension:         0.3,
      pointRadius:     0,
      pointHoverRadius:3,
    }));

    this._popChart = new Chart(this._popCanvas, {
      type: 'line',
      data: { labels: [], datasets },
      options: {
        ...baseChartOptions('Count'),
        scales: {
          ...baseChartOptions('Count').scales,
          y: { ...baseChartOptions('Count').scales.y, stacked: true, min: 0 },
        },
      },
    });
  }

  _updatePopChart() {
    if (!this._popChart) return;
    const history  = this._downsample(this._history, CHART_MAX_POINTS);
    const labels   = history.map(h => h.generation);
    this._popChart.data.labels = labels;
    STRATEGIES.forEach((s, i) => {
      this._popChart.data.datasets[i].data = history.map(h => h.counts[s.id] || 0);
    });
    this._popChart.update('none');
  }

  // ─── Scores chart ─────────────────────────────────────────────────────────────

  _initScoreChart() {
    if (!this._scoreCanvas) return;
    const datasets = STRATEGIES.map(s => ({
      label:           s.name,
      data:            [],
      borderColor:     s.color,
      backgroundColor: hexAlpha(s.color, 0.1),
      borderWidth:     1.5,
      fill:            false,
      tension:         0.3,
      pointRadius:     0,
      pointHoverRadius:3,
    }));

    this._scoreChart = new Chart(this._scoreCanvas, {
      type: 'line',
      data: { labels: [], datasets },
      options: baseChartOptions('Avg Score'),
    });
  }

  _updateScoreChart() {
    if (!this._scoreChart) return;
    const history = this._downsample(this._history, CHART_MAX_POINTS);
    const labels  = history.map(h => h.generation);
    this._scoreChart.data.labels = labels;
    STRATEGIES.forEach((s, i) => {
      this._scoreChart.data.datasets[i].data = history.map(h => +(h.avgScores[s.id] || 0).toFixed(3));
    });
    this._scoreChart.update('none');
  }

  // ─── Events chart ─────────────────────────────────────────────────────────────

  _initEventChart() {
    if (!this._eventCanvas) return;
    this._eventChart = new Chart(this._eventCanvas, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          { label: 'Births',    data: [], backgroundColor: hexAlpha('#4caf50', 0.7), borderWidth: 0 },
          { label: 'Deaths',    data: [], backgroundColor: hexAlpha('#ef5350', 0.7), borderWidth: 0 },
          { label: 'Mutations', data: [], backgroundColor: hexAlpha('#f59e0b', 0.7), borderWidth: 0 },
        ],
      },
      options: {
        ...baseChartOptions('Count'),
        scales: {
          ...baseChartOptions('Count').scales,
          x: { ...baseChartOptions('Count').scales.x, stacked: true },
          y: { ...baseChartOptions('Count').scales.y, stacked: true, min: 0 },
        },
      },
    });
  }

  _updateEventChart() {
    if (!this._eventChart) return;
    const buf    = this._downsample(this._eventBuffer, CHART_MAX_POINTS);
    const labels = buf.map(e => e.generation);
    this._eventChart.data.labels              = labels;
    this._eventChart.data.datasets[0].data   = buf.map(e => e.births);
    this._eventChart.data.datasets[1].data   = buf.map(e => e.deaths);
    this._eventChart.data.datasets[2].data   = buf.map(e => e.mutations);
    this._eventChart.update('none');
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /** Downsample an array to at most maxPoints entries (keep first & last). */
  _downsample(arr, maxPoints) {
    if (arr.length <= maxPoints) return arr;
    const step = arr.length / maxPoints;
    const result = [];
    for (let i = 0; i < maxPoints; i++) {
      result.push(arr[Math.round(i * step)]);
    }
    return result;
  }

  _destroyAll() {
    [this._popChart, this._scoreChart, this._eventChart].forEach(c => {
      if (c) { c.destroy(); }
    });
    this._popChart   = null;
    this._scoreChart = null;
    this._eventChart = null;
  }

  destroy() { this._destroyAll(); }
}
