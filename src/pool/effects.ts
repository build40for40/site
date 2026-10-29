import { poolConfig, type SearchEffect } from "./config";
import type { Vector } from "./motion";
import type { PhysicsController } from "./physics";
import type { Match } from "./search";

type Controller = Pick<PhysicsController, "applyImpulse" | "wake" | "setBodyTarget" | "setBodyGravityScale" | "setBodyScale">;

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
  let waves: ReturnType<typeof setTimeout>[] = [];

  function clear() {
    waves.forEach(clearTimeout);
    waves = [];
    for (const id of affected) {
      controller.setBodyTarget(id, null);
      controller.setBodyGravityScale(id, 1);
      controller.setBodyScale(id, 1);
      controller.wake(id);
    }
    affected = [];
  }

  // Matches set off a few at a time, best first, so they don't all shoulder through the pile at once.
  function spring(matches: Match[]) {
    const { grow, label, gap, rows, wave, waveGapMs, stiffness, damping } = settings.spring;
    const { width, tile } = layout();
    const cell = { width: tile.width * grow, height: tile.height * grow + label };
    const perRow = Math.max(1, Math.floor((width - gap) / (cell.width + gap)));
    const slots = slotPositions(Math.min(matches.length, perRow * rows), { width, tile: cell }, gap);
    slots.forEach((slot, i) => {
      const launch = () => {
        controller.setBodyScale(matches[i].id, grow);
        controller.setBodyTarget(matches[i].id, { x: slot.x, y: slot.y + label / 2 }, { mode: "spring", stiffness, damping });
      };
      const delay = Math.floor(i / wave) * waveGapMs;
      if (delay) waves.push(setTimeout(launch, delay));
      else launch();
    });
  }

  function apply(matches: Match[]) {
    clear();
    affected = matches.map((m) => m.id);
    if (effect === "spring") spring(matches);
    else if (effect === "attract") {
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
