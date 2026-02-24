/**
 * strategies.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Defines all blob strategies for the Evolutionary Game of Life simulation.
 * Each strategy is a pure function:
 *
 *   decide(memory, opponentId, params) → 'C' | 'D'
 *
 *   memory     : Array of { myMove, opponentMove } for past rounds vs opponentId
 *   opponentId : The opponent blob's unique id
 *   params     : Simulation parameters (payoff matrix, etc.)
 *
 * MOVE CONSTANTS:
 *   'C' = Cooperate
 *   'D' = Defect
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const COOPERATE = 'C';
export const DEFECT    = 'D';

// ─── Utility helpers ──────────────────────────────────────────────────────────

/** Returns the last N moves the opponent made against us. */
function opponentHistory(memory, n = Infinity) {
  return memory.slice(-n).map(r => r.opponentMove);
}

/** Count how many times the opponent defected in the memory window. */
function opponentDefectCount(memory, n = Infinity) {
  return opponentHistory(memory, n).filter(m => m === DEFECT).length;
}

/** Most recent move the opponent made (or null if no history). */
function lastOpponentMove(memory) {
  return memory.length > 0 ? memory[memory.length - 1].opponentMove : null;
}

/** Most recent move we made (or null if no history). */
function lastMyMove(memory) {
  return memory.length > 0 ? memory[memory.length - 1].myMove : null;
}

// ─── Strategy definitions ─────────────────────────────────────────────────────

/**
 * ALWAYS COOPERATE
 * The pacifist. Never defects regardless of history.
 * Performs poorly against defectors, great in cooperative populations.
 */
export function alwaysCooperate(_memory) {
  return COOPERATE;
}

/**
 * ALWAYS DEFECT
 * The exploiter. Always defects regardless of history.
 * Exploits cooperators, draws with other defectors.
 */
export function alwaysDefect(_memory) {
  return DEFECT;
}

/**
 * TIT-FOR-TAT (TFT)
 * The classic Axelrod winner. Cooperates first, then mirrors the opponent's
 * last move exactly. Rewards cooperation, punishes defection immediately.
 */
export function titForTat(memory) {
  if (memory.length === 0) return COOPERATE;
  return lastOpponentMove(memory);
}

/**
 * TIT-FOR-TWO-TATS (TF2T)
 * More forgiving than TFT. Defects only if the opponent defected in the LAST
 * TWO consecutive rounds. Resistant to accidental noise.
 */
export function titForTwoTats(memory) {
  if (memory.length < 2) return COOPERATE;
  const last2 = memory.slice(-2).map(r => r.opponentMove);
  return last2.every(m => m === DEFECT) ? DEFECT : COOPERATE;
}

/**
 * GRUDGER (GRIM TRIGGER)
 * Cooperates until the opponent defects ONCE, then defects forever.
 * Has long memory — a single betrayal ends cooperation permanently.
 */
export function grudger(memory) {
  if (opponentDefectCount(memory) > 0) return DEFECT;
  return COOPERATE;
}

/**
 * PAVLOV (WIN-STAY LOSE-SHIFT)
 * Repeats the previous move if it led to a good outcome (T or R),
 * switches if it led to a bad outcome (P or S).
 * "Win" = got R (mutual coop) or T (exploited opponent).
 * "Lose" = got P (mutual defect) or S (got exploited).
 */
export function pavlov(memory, _opponentId, params) {
  if (memory.length === 0) return COOPERATE;
  const last = memory[memory.length - 1];
  // Calculate last round's payoff to self
  const payoff = getPayoff(last.myMove, last.opponentMove, params);
  // Win threshold: anything above punishment is a "win"
  const winThreshold = params.payoff.P;
  if (payoff > winThreshold) {
    return last.myMove; // stay
  } else {
    return last.myMove === COOPERATE ? DEFECT : COOPERATE; // shift
  }
}

/** Helper to compute own payoff given both moves. */
function getPayoff(myMove, opponentMove, params) {
  const { T, R, P, S } = params.payoff;
  if (myMove === COOPERATE && opponentMove === COOPERATE) return R;
  if (myMove === COOPERATE && opponentMove === DEFECT)    return S;
  if (myMove === DEFECT    && opponentMove === COOPERATE) return T;
  return P; // both defect
}

/**
 * RANDOM
 * Completely random. 50/50 cooperate or defect each round.
 * Acts as a baseline / noise agent.
 */
export function random(_memory) {
  return Math.random() < 0.5 ? COOPERATE : DEFECT;
}

/**
 * GENEROUS TIT-FOR-TAT (GTFT)
 * Like TFT but occasionally forgives defection with a 10% chance.
 * Helps escape mutual defection spirals. Slightly less exploitable than TFT.
 */
export function generousTitForTat(memory) {
  if (memory.length === 0) return COOPERATE;
  if (lastOpponentMove(memory) === COOPERATE) return COOPERATE;
  // Opponent defected — forgive with 10% probability
  return Math.random() < 0.10 ? COOPERATE : DEFECT;
}

/**
 * DETECTIVE
 * Probes the opponent for the first 4 rounds with a fixed sequence:
 *   C, D, C, C
 * If the opponent never retaliates, switch to ALWAYS DEFECT (they're a pushover).
 * If the opponent retaliates at ANY point, fall back to TIT-FOR-TAT.
 */
export function detective(memory) {
  const PROBE = [COOPERATE, DEFECT, COOPERATE, COOPERATE];
  const n = memory.length;

  if (n < PROBE.length) {
    return PROBE[n];
  }

  // After probing: check if opponent ever retaliated
  const probeOpponent = memory.slice(0, 4).map(r => r.opponentMove);
  const retaliated = probeOpponent.includes(DEFECT);

  if (!retaliated) {
    return DEFECT; // safe to exploit
  } else {
    // Behave like TFT from here on
    return lastOpponentMove(memory);
  }
}

/**
 * SOFT MAJORITY
 * Cooperates if the opponent cooperated in the MAJORITY of past rounds.
 * Defects otherwise. Fairly tolerant but reacts to sustained defection.
 */
export function softMajority(memory) {
  if (memory.length === 0) return COOPERATE;
  const total = memory.length;
  const coops = memory.filter(r => r.opponentMove === COOPERATE).length;
  return coops >= total / 2 ? COOPERATE : DEFECT;
}

// ─── Strategy Registry ────────────────────────────────────────────────────────

/**
 * Master registry of all strategies.
 * Each entry:
 *   id      : unique string key
 *   name    : display name
 *   short   : short abbreviation for tables
 *   desc    : one-line description
 *   color   : CSS colour for canvas / legend
 *   decide  : function(memory, opponentId, params) → 'C'|'D'
 *   weight  : default initial population weight (%)
 */
export const STRATEGIES = [
  {
    id:     'alwaysCooperate',
    name:   'Always Cooperate',
    short:  'AC',
    desc:   'Never defects — the pacifist.',
    color:  '#66bb6a',
    decide:  alwaysCooperate,
    weight:  11,
  },
  {
    id:     'alwaysDefect',
    name:   'Always Defect',
    short:  'AD',
    desc:   'Never cooperates — the exploiter.',
    color:  '#ef5350',
    decide:  alwaysDefect,
    weight:  11,
  },
  {
    id:     'titForTat',
    name:   'Tit-for-Tat',
    short:  'TFT',
    desc:   'Mirrors the opponent\'s last move.',
    color:  '#42a5f5',
    decide:  titForTat,
    weight:  12,
  },
  {
    id:     'titForTwoTats',
    name:   'Tit-for-Two-Tats',
    short:  'TF2T',
    desc:   'Forgives a single defection.',
    color:  '#26c6da',
    decide:  titForTwoTats,
    weight:  11,
  },
  {
    id:     'grudger',
    name:   'Grudger',
    short:  'GR',
    desc:   'Cooperates until betrayed once, then defects forever.',
    color:  '#ff7043',
    decide:  grudger,
    weight:  11,
  },
  {
    id:     'pavlov',
    name:   'Pavlov',
    short:  'PV',
    desc:   'Win-stay, lose-shift.',
    color:  '#ab47bc',
    decide:  pavlov,
    weight:  11,
  },
  {
    id:     'random',
    name:   'Random',
    short:  'RN',
    desc:   '50/50 cooperation each round.',
    color:  '#bdbdbd',
    decide:  random,
    weight:  11,
  },
  {
    id:     'generousTitForTat',
    name:   'Generous TFT',
    short:  'GTFT',
    desc:   'TFT that occasionally forgives defection (10%).',
    color:  '#29b6f6',
    decide:  generousTitForTat,
    weight:  11,
  },
  {
    id:     'detective',
    name:   'Detective',
    short:  'DT',
    desc:   'Probes then exploits or uses TFT.',
    color:  '#ffa726',
    decide:  detective,
    weight:  10,
  },
  {
    id:     'softMajority',
    name:   'Soft Majority',
    short:  'SM',
    desc:   'Cooperates if opponent cooperated in majority of past rounds.',
    color:  '#a5d6a7',
    decide:  softMajority,
    weight:  10,
  },
];

/** Map from strategy id → strategy object for O(1) lookup. */
export const STRATEGY_MAP = Object.fromEntries(STRATEGIES.map(s => [s.id, s]));

/** Return a random strategy id. */
export function randomStrategyId() {
  return STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)].id;
}

/** Return a strategy id different from the given one (for mutation). */
export function mutateStrategy(currentId) {
  const others = STRATEGIES.filter(s => s.id !== currentId);
  return others[Math.floor(Math.random() * others.length)].id;
}
