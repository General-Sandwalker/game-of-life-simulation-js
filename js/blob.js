/**
 * blob.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Blob entity: the core agent in the evolutionary simulation.
 *
 * A Blob:
 *  • Has a fixed strategy (cannot change without mutation on reproduction).
 *  • Has a score (energy). Dies if score < deathThreshold, reproduces if score ≥ reproThreshold.
 *  • Remembers previous rounds played against each opponent.
 *  • Has a visual position for the canvas renderer.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { STRATEGY_MAP, mutateStrategy } from './strategies.js';

let _nextId = 1;

export class Blob {
  /**
   * @param {string}  strategyId  - Key from STRATEGY_MAP
   * @param {number}  score       - Starting score / energy
   * @param {object}  [parent]    - Parent blob (for lineage tracking); null for founders
   * @param {boolean} [mutated]   - Whether this blob mutated from its parent
   */
  constructor(strategyId, score, parent = null, mutated = false) {
    this.id         = _nextId++;
    this.strategyId = strategyId;
    this.score      = score;
    this.age        = 0;        // generations survived
    this.generation = parent ? parent.generation + 1 : 0;
    this.parentId   = parent ? parent.id : null;
    this.mutated    = mutated;

    // Match statistics
    this.wins       = 0;
    this.losses     = 0;
    this.draws      = 0;
    this.totalRoundsPlayed = 0;
    this.cooperations = 0;
    this.defections   = 0;

    /**
     * Memory of past interactions with other blobs.
     * Map<opponentId, Array<{ myMove: 'C'|'D', opponentMove: 'C'|'D' }>>
     */
    this.memory = new Map();

    // Canvas rendering position (assigned by renderer)
    this.x  = Math.random();  // normalised [0,1]
    this.y  = Math.random();
    this.vx = (Math.random() - 0.5) * 0.002;
    this.vy = (Math.random() - 0.5) * 0.002;
    this.displayRadius = 0;     // set by renderer based on score
    this.glowIntensity = 0;     // animated glow for recent events
    this.pulsePhase   = Math.random() * Math.PI * 2; // for idle animation
  }

  /** Shortcut to this blob's strategy descriptor. */
  get strategy() {
    return STRATEGY_MAP[this.strategyId];
  }

  /**
   * Decide move against a given opponent.
   * @param {number}  opponentId
   * @param {object}  params       - Simulation params (for Pavlov payoff check)
   * @param {number}  memoryLen    - Max rounds to pass as context
   * @returns {'C'|'D'}
   */
  decide(opponentId, params, memoryLen) {
    const history = this.getMemory(opponentId, memoryLen);
    return this.strategy.decide(history, opponentId, params);
  }

  /**
   * Record the outcome of ONE round vs an opponent.
   * @param {number} opponentId
   * @param {'C'|'D'} myMove
   * @param {'C'|'D'} opponentMove
   * @param {number}  memoryLen   - Max entries to retain per opponent
   */
  recordRound(opponentId, myMove, opponentMove, memoryLen) {
    if (!this.memory.has(opponentId)) {
      this.memory.set(opponentId, []);
    }
    const hist = this.memory.get(opponentId);
    hist.push({ myMove, opponentMove });
    // Trim to memory window
    if (hist.length > memoryLen) {
      hist.splice(0, hist.length - memoryLen);
    }

    this.totalRoundsPlayed++;
    if (myMove === 'C') this.cooperations++;
    else                 this.defections++;
  }

  /**
   * Get remembered history vs an opponent (up to memoryLen rounds).
   * @returns {Array<{myMove, opponentMove}>}
   */
  getMemory(opponentId, memoryLen = Infinity) {
    const hist = this.memory.get(opponentId) || [];
    return hist.slice(-memoryLen);
  }

  /** Apply a score delta (positive or negative). */
  applyPayoff(delta) {
    this.score = Math.max(0, this.score + delta);
  }

  /** Record a match outcome (win / loss / draw) vs another blob. */
  recordMatchOutcome(myTotalPayoff, opponentTotalPayoff) {
    if (myTotalPayoff > opponentTotalPayoff) this.wins++;
    else if (myTotalPayoff < opponentTotalPayoff) this.losses++;
    else this.draws++;
  }

  /**
   * Attempt to reproduce.
   * Returns a new child Blob or null if score is below threshold.
   * When the child is born, the parent's score is halved (energy split).
   *
   * @param {object} params  - { reproThreshold, mutationRate, initScore }
   * @returns {Blob|null}
   */
  tryReproduce(params) {
    if (this.score < params.reproThreshold) return null;

    const mutated = Math.random() < params.mutationRate;
    const childStrategyId = mutated ? mutateStrategy(this.strategyId) : this.strategyId;

    // Split energy
    this.score = this.score / 2;
    const childScore = this.score;

    const child = new Blob(childStrategyId, childScore, this, mutated);
    // Place child near parent
    child.x = Math.min(1, Math.max(0, this.x + (Math.random() - 0.5) * 0.05));
    child.y = Math.min(1, Math.max(0, this.y + (Math.random() - 0.5) * 0.05));

    return child;
  }

  /**
   * @returns {boolean} true if this blob should die
   */
  isDead(deathThreshold) {
    return this.score < deathThreshold;
  }

  /** Increment age at the end of each generation. */
  tick() {
    this.age++;
    this.pulsePhase += 0.05;
  }

  /**
   * Serialise basic info for display.
   * @returns {object}
   */
  toDisplay() {
    const coop = this.totalRoundsPlayed > 0
      ? Math.round((this.cooperations / this.totalRoundsPlayed) * 100)
      : 0;
    return {
      id:       this.id,
      strategy: this.strategy.name,
      color:    this.strategy.color,
      score:    this.score.toFixed(2),
      age:      this.age,
      gen:      this.generation,
      wins:     this.wins,
      losses:   this.losses,
      draws:    this.draws,
      coopRate: coop,
      mutated:  this.mutated,
    };
  }
}

/** Reset the global id counter (call when starting a fresh simulation). */
export function resetBlobIds() {
  _nextId = 1;
}
