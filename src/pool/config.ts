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
    pointer: { radius: 26, maxSpeed: 25 },
    // Spring stiffness and damping are per kilogram, so big and small ideas feel the same.
    drag: { stiffness: 150, damping: 20, threshold: 6, longPressMs: 260 },
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
      spring: { stiffness: 40, damping: 10, gap: 8 },
      impulse: { strength: 9 },
      attract: { strength: 60, durationMs: 2500 },
      gravity: { scale: -0.4 },
    },
  },
  artwork: {
    version: 1,
  },
};

export type PoolConfig = typeof poolConfig;
