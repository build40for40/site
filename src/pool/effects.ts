import { poolConfig } from "./config";
import type { PhysicsController } from "./physics";
import type { Match } from "./search";

type Controller = Pick<PhysicsController, "setBodyHover">;

interface Band {
  height: number;
  tile: number;
}

// Funded ideas that miss the days come out bigger: twice as wide at fullAt, which is about the most anyone pays, and
// on a square root so the first £40 already shows. Unfunded ones are smaller still.
export function boxScale(raised: number, { fullAt, unfunded } = poolConfig.boxes) {
  return raised > 0 ? Number((1 + Math.min(1, Math.sqrt(raised / fullAt))).toFixed(2)) : unfunded;
}

// A score of 1 rises to the top of the pool, under room for its percentage, and lower scores in proportion towards
// the floor. Below the threshold an idea stays in the pile.
export function liftHeight(score: number, { height, tile }: Band, { label = poolConfig.search.label, minRelevance = poolConfig.search.minRelevance } = {}) {
  if (score < minRelevance) return null;
  const floor = height - tile / 2;
  const ceiling = label + tile / 2;
  return floor - Math.min(1, score) * Math.max(0, floor - ceiling);
}

export function createLift(controller: Controller, band: () => Band) {
  let lifted = new Set<string>();

  function apply(matches: Match[]) {
    const next = new Set<string>();
    for (const m of matches) {
      const y = liftHeight(m.score, band());
      if (y === null) continue;
      controller.setBodyHover(m.id, y);
      next.add(m.id);
    }
    for (const id of lifted) if (!next.has(id)) controller.setBodyHover(id, null);
    lifted = next;
  }

  return { apply, clear: () => apply([]) };
}
