// The time machine: fly down a tunnel of year rings from now back to a year.
// Each ring is a year in its colour, the lights on it are that year's top trends,
// and signs float past for the reader's milestones.

import { FIRST_YEAR, NOW_YEAR, clamp, token, type Nerds, type Trend } from "./data";
import { FONT, reducedMotion, stage } from "./stage";

interface Sign { year: number; text: string }

export function tunnel(el: HTMLElement, nerds: Nerds, options: { height: string; label: string }) {
  let camera = NOW_YEAR + 1.5;
  let target: number | null = null;
  let flyFrom = camera;
  let flyStart = 0;
  let flyTime = 6;
  let done: (() => void) | undefined;
  let signs: Sign[] = [];
  let clock = 0;
  let steerX = 0;
  let steerY = 0;
  const still = reducedMotion();
  const tops = new Map<number, Trend[]>();
  const topsFor = (year: number) => {
    if (!tops.has(year)) tops.set(year, nerds.top(year, 5));
    return tops.get(year)!;
  };
  const stars = Array.from({ length: 120 }, () => ({
    angle: Math.random() * Math.PI * 2,
    radius: 0.3 + Math.random() * 1.4,
    z: Math.random() * 30,
    colour: nerds.colour(FIRST_YEAR + Math.floor(Math.random() * (NOW_YEAR - FIRST_YEAR))),
  }));
  const night = token("--color-nof-night", "#0e0d12");
  const text = token("--color-nof-text", "#f2eee6");
  const pink = token("--color-nof-pink", "#ff6fa8");

  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

  const s = stage(el, {
    height: options.height,
    label: options.label,
    animate: true,
    render({ ctx, width: w, height: h, dt }, pointer) {
      clock += dt;
      const m = Math.min(w, h);
      let speed = 1.2;
      if (target !== null) {
        const t = clamp((clock - flyStart) / flyTime, 0, 1);
        const next = still ? target : flyFrom + (target - flyFrom) * ease(t);
        speed = Math.abs(next - camera) / Math.max(dt, 0.001);
        camera = next;
        if (t >= 1 && done) {
          const finish = done;
          done = undefined;
          finish();
        }
      } else if (!still) {
        camera -= dt * 0.9;
        if (camera < FIRST_YEAR + 2) camera = NOW_YEAR + 1.5;
      }
      if (pointer.inside) {
        steerX += (pointer.x / w - 0.5 - steerX) * Math.min(1, dt * 2);
        steerY += (pointer.y / h - 0.5 - steerY) * Math.min(1, dt * 2);
      } else {
        steerX *= 1 - Math.min(1, dt);
        steerY *= 1 - Math.min(1, dt);
      }

      ctx.globalAlpha = 0.6;
      ctx.fillStyle = night;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;

      const project = (dz: number, angle: number, r: number) => {
        const scale = 1 / dz;
        const cx = w / 2 + steerX * w * 0.4 * (1 - Math.min(1, scale));
        const cy = h / 2 + steerY * h * 0.4 * (1 - Math.min(1, scale));
        return { x: cx + Math.cos(angle) * r * m * 0.62 * scale, y: cy + Math.sin(angle) * r * m * 0.62 * scale, scale, cx, cy };
      };

      // Streaks of colour rushing past.
      const streak = clamp(speed / 6, 0.6, 6);
      for (const star of stars) {
        const before = star.z;
        star.z -= dt * streak * 3;
        if (star.z < 0.2) {
          star.z = 30;
          star.angle = Math.random() * Math.PI * 2;
        }
        const a = project(Math.max(0.2, before), star.angle, star.radius);
        const b = project(Math.max(0.2, star.z), star.angle, star.radius);
        ctx.globalAlpha = clamp(1.2 - star.z / 30, 0, 0.8);
        ctx.strokeStyle = star.colour;
        ctx.lineWidth = Math.max(0.5, b.scale * 2);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Year rings ahead of the camera, furthest first. Ahead means further back in time.
      const nearest = Math.floor(camera);
      for (let year = Math.max(FIRST_YEAR, nearest - 36); year <= Math.min(NOW_YEAR, nearest); year++) {
        const dz = camera - year + 0.6;
        if (dz < 0.15) continue;
        const { scale, cx, cy } = project(dz, 0, 1);
        const radius = m * 0.62 * scale;
        const alpha = clamp(1.3 - dz / 32, 0, 1) * clamp(dz * 1.6, 0, 1);
        const isTarget = target !== null && year === target;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = nerds.colour(year);
        ctx.lineWidth = Math.max(0.6, (isTarget ? 5 : 2.2) * scale * 3);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();

        // The year's top trends as lights on the ring, named when close.
        const trends = topsFor(year);
        trends.forEach((trend, i) => {
          const angle = (i / trends.length) * Math.PI * 2 + year * 0.37;
          const px = cx + Math.cos(angle) * radius * 0.82;
          const py = cy + Math.sin(angle) * radius * 0.82;
          const r = Math.max(1, 4.5 * scale * 2.4);
          const glow = ctx.createRadialGradient(px, py, 0, px, py, r * 3);
          glow.addColorStop(0, text);
          glow.addColorStop(0.3, nerds.colour(year));
          glow.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(px, py, r * 3, 0, Math.PI * 2);
          ctx.fill();
          if (dz < 3.2 && i < 3) {
            ctx.font = FONT.body(clamp(14 * scale * 1.5, 10, 24), 600);
            ctx.fillStyle = text;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(trend.name, px, py - r * 2.6);
          }
        });

        // Milestone signs hang on their ring.
        const sign = signs.find((entry) => entry.year === year);
        if (sign && dz < 7) {
          const size = clamp(16 * scale * 1.6, 11, 30);
          ctx.font = FONT.display(size, 700, true);
          const label = sign.text;
          const tw = ctx.measureText(label).width;
          const sx = cx;
          const sy = cy + radius * 0.55;
          ctx.fillStyle = pink;
          ctx.beginPath();
          ctx.roundRect(sx - tw / 2 - size * 0.6, sy - size * 0.9, tw + size * 1.2, size * 1.8, size * 0.4);
          ctx.fill();
          ctx.fillStyle = night;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, sx, sy + 1);
        }

        if (dz < 4) {
          ctx.font = FONT.display(clamp(radius * 0.2, 12, 110), 600, true);
          ctx.fillStyle = text;
          ctx.textAlign = "center";
          ctx.textBaseline = "alphabetic";
          ctx.fillText(String(year), cx, cy - radius - 8 * scale);
        }
      }
      ctx.globalAlpha = 1;

      // The counter.
      const shown = clamp(Math.round(camera), FIRST_YEAR, NOW_YEAR);
      ctx.font = FONT.display(clamp(m * 0.16, 44, 120), 900);
      ctx.fillStyle = text;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(String(shown), 16, h - 18);
      ctx.fillStyle = nerds.colour(shown);
      ctx.fillRect(18, h - 18 - clamp(m * 0.16, 44, 120) - 10, 40, 6);
    },
  });

  return {
    stage: s,
    /** Fly from now back to `year`, hanging `signs` on their rings, then call `onArrive`. */
    fly(year: number, milestoneSigns: Sign[], onArrive: () => void) {
      signs = milestoneSigns;
      flyFrom = NOW_YEAR + 1.5;
      camera = flyFrom;
      target = year;
      flyStart = clock;
      flyTime = clamp((NOW_YEAR - year) / 9, 3.2, 7);
      done = onArrive;
    },
    /** Hover at a year without flying. */
    park(year: number) {
      target = year;
      camera = year + 0.6;
      flyStart = clock - 100;
      done = undefined;
    },
    destroy: () => s.destroy(),
  };
}
