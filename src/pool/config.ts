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
    cacheSeconds: 600,
    // Room above a risen idea for its match percentage.
    label: 18,
  },
  artwork: {
    version: 2,
  },
};

export type PoolConfig = typeof poolConfig;
