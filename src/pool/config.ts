export type SearchEffect = "spring" | "impulse" | "wake" | "attract" | "gravity";

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
    drag: { stiffness: 150, damping: 20, threshold: 6, longPressMs: 260 },
    // Share of the way to a new size covered each step, and how fast a held idea turns upright.
    growRate: 0.12,
    upright: 8,
    // Velocities in metres per second.
    jolt: { share: 0.3, max: 12, strength: 4, gapMs: 70 },
  },
  motion: {
    tiltStrength: 1.6,
    maxGravity: 40,
    smoothing: 0.15,
    shake: { threshold: 18, hits: 3, windowMs: 600, cooldownMs: 1500, impulse: 6, maxImpulse: 14 },
  },
  search: {
    effect: "spring" as SearchEffect,
    debounceMs: 250,
    timeoutMs: 2500,
    minQueryLength: 2,
    shortlist: 20,
    // Levels for the classifier's relevance score, lowest first. Each describes a situation, not a degree.
    relevanceLevels: [
      "The idea has nothing to do with what the person searched for",
      "The idea shares a word or a loose theme with the search but solves a different problem",
      "The idea tackles the same kind of problem the search describes",
      "The idea is exactly the problem the search describes",
    ],
    minRelevance: 0.34,
    cacheSeconds: 600,
    effects: {
      // Matches grow to `grow` times their size and leave the pile `wave` at a time, best first. `label` is the room
      // above each one for its match percentage.
      spring: { stiffness: 40, damping: 10, gap: 8, grow: 2, label: 18, rows: 2, wave: 3, waveGapMs: 70 },
      impulse: { strength: 9 },
      attract: { strength: 60, durationMs: 2500 },
      gravity: { scale: -0.4 },
    },
  },
  artwork: {
    version: 2,
  },
};

export type PoolConfig = typeof poolConfig;
