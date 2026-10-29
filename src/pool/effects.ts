import { poolConfig, type SearchEffect } from "./config";
import type { Vector } from "./motion";
import type { PhysicsController } from "./physics";
import type { Match } from "./search";

type Controller = Pick<PhysicsController, "applyImpulse" | "wake" | "setBodyTarget" | "setBodyGravityScale">;

interface Layout {
  width: number;
  tile: { width: number; height: number };
}

export function slotPositions(count: number, { width, tile }: Layout, gap: number): Vector[] {
  const perRow = Math.max(1, Math.floor((width - gap) / (tile.width + gap)));
  return Array.from({ length: count }, (_, i) => ({
    x: gap + tile.width / 2 + (i % perRow) * (tile.width + gap),
    y: gap + tile.height / 2 + Math.floor(i / perRow) * (tile.height + gap),
  }));
}

export function createSearchEffects(controller: Controller, layout: () => Layout, effect: SearchEffect = poolConfig.search.effect, settings = poolConfig.search.effects) {
  let affected: string[] = [];

  function clear() {
    for (const id of affected) {
      controller.setBodyTarget(id, null);
      controller.setBodyGravityScale(id, 1);
      controller.wake(id);
    }
    affected = [];
  }

  function apply(matches: Match[]) {
    clear();
    affected = matches.map((m) => m.id);
    if (effect === "spring") {
      const slots = slotPositions(matches.length, layout(), settings.spring.gap);
      matches.forEach((m, i) => controller.setBodyTarget(m.id, slots[i], { mode: "spring", stiffness: settings.spring.stiffness, damping: settings.spring.damping }));
    } else if (effect === "attract") {
      const { width, tile } = layout();
      const point = { x: width / 2, y: tile.height / 2 };
      for (const m of matches) controller.setBodyTarget(m.id, point, { mode: "force", strength: settings.attract.strength * m.score, durationMs: settings.attract.durationMs });
    } else if (effect === "gravity") {
      for (const m of matches) controller.setBodyGravityScale(m.id, settings.gravity.scale);
    } else if (effect === "impulse") {
      for (const m of matches) controller.applyImpulse(m.id, { x: 0, y: -settings.impulse.strength * (0.5 + m.score / 2) });
    } else {
      for (const m of matches) controller.wake(m.id);
    }
  }

  return { apply, clear };
}
