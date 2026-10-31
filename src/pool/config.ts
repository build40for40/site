export const poolConfig = {
  physics: {
    enabled: true,
    // Past this, the pool shows the plain grid instead of waiting on the physics engine.
    loadTimeoutMs: 3000,
    pxPerMeter: 50,
    gravity: { x: 0, y: 20 },
    timestep: 1 / 60,
    maxSubsteps: 5,
    maxSpeed: 30,
    body: { density: 1, restitution: 0.2, friction: 0.6, linearDamping: 0.4, angularDamping: 0.8 },
    wallThickness: 2,
    // Each new idea drops in this long after the one before it.
    rainStaggerMs: 90,
    rainSpeed: 6,
    // Spring stiffness and damping are per kilogram, so big and small ideas feel the same.
    hover: { stiffness: 30, damping: 9 },
    // How fast a hovering idea turns upright.
    upright: 8,
    // Every so often the lava burps a resting idea out of the pile, and typing makes one twitch. Speeds are in metres
    // per second, spin in radians per second.
    boil: { everyMs: [600, 1800], speed: [4.5, 8.5], spin: 10 },
    nudge: { speed: 3, gapMs: 80 },
    // Pressing an idea for holdMs, or moving more than movePx while pressed, picks it up. A held idea moves towards the
    // pointer at follow times the gap per second, and keeps spinKeep of its spin each step.
    drag: { holdMs: 180, movePx: 6, follow: 18, spinKeep: 0.9 },
    // A problem sent from the join form splashes the ideas it lands near. Losing more than impact metres per second of
    // downward speed in one step counts as landing.
    drop: { impact: 2, splash: { radius: 160, speed: 6 } },
  },
  boxes: {
    pxPerPound: 1,
    maxGrowth: 72,
  },
  search: {
    debounceMs: 400,
    timeoutMs: 2500,
    minLength: 12,
    shortlist: 20,
    // Levels for the classifier's relevance score, lowest first. Each describes a situation, not a degree.
    relevanceLevels: [
      "The idea has nothing to do with what the person searched for",
      "The idea shares a word or a loose theme with the search but solves a different problem",
      "The idea tackles the same kind of problem the search describes",
      "The idea is exactly the problem the search describes",
    ],
    minRelevance: 0.34,
    // Without the classifier, the join form floats up only this many of the best word matches.
    lexicalMost: 5,
    cacheSeconds: 600,
    // Room above a risen idea for its match percentage.
    label: 18,
    // Browsing searches from a few letters, where the join form waits for a sentence.
    browseMinLength: 3,
  },
  artwork: {
    version: 2,
  },
};

export type PoolConfig = typeof poolConfig;
