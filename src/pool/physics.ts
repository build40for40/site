import * as RAPIER from "@dimforge/rapier2d";
import { poolConfig } from "./config";

export interface Vector {
  x: number;
  y: number;
}

type Config = typeof poolConfig.physics & {
  autoStart?: boolean;
  autoPause?: boolean;
};

interface BodyOptions {
  shape?: "box" | "circle";
  width?: number;
  height?: number;
  spawn?: Vector;
  delayMs?: number;
  density?: number;
  restitution?: number;
  friction?: number;
  linearDamping?: number;
  angularDamping?: number;
}

interface Pose {
  x: number;
  y: number;
  a: number;
}

interface Tracked {
  id: string;
  element: HTMLElement;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  shape: "box" | "circle";
  width: number;
  height: number;
  mass: number;
  fixedSize: boolean;
  prev: Pose;
  curr: Pose;
  spawnAt: number;
  pickSpawn: boolean;
  shown: boolean;
  drawn?: string;
  hover?: number;
}

export type PhysicsController = ReturnType<typeof initializePhysics>;

export function initializePhysics(container: HTMLElement, overrides: Partial<Config> = {}) {
  const config: Config = { ...poolConfig.physics, autoStart: true, autoPause: true, ...overrides };
  const scale = config.pxPerMeter;
  const toM = (px: number) => px / scale;
  const toPx = (m: number) => m * scale;

  const world = new RAPIER.World({ x: config.gravity.x, y: config.gravity.y });
  world.timestep = config.timestep;
  const bodies = new Map<string, Tracked>();
  const cleanups: (() => void)[] = [];
  let size = { width: 0, height: 0 };
  let walls: RAPIER.RigidBody | undefined;
  let clock = 0;

  const maxV = config.maxSpeed;

  function buildWalls() {
    if (walls) world.removeRigidBody(walls);
    const w = toM(size.width);
    const h = toM(size.height);
    const t = config.wallThickness;
    walls = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    for (const [x, y, hx, hy] of [
      [w / 2, h + t / 2, w / 2 + t, t / 2],
      [w / 2, -t / 2, w / 2 + t, t / 2],
      [-t / 2, h / 2, t / 2, h / 2 + t],
      [w + t / 2, h / 2, t / 2, h / 2 + t],
    ]) {
      world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy).setTranslation(x, y).setFriction(config.body.friction), walls);
    }
  }

  function measure() {
    return { width: container.clientWidth, height: container.clientHeight };
  }

  const clampInside = (t: Tracked) => {
    const p = t.body.translation();
    const hw = toM(t.width / 2);
    const hh = toM(t.height / 2);
    const x = Math.min(Math.max(p.x, hw), Math.max(hw, toM(size.width) - hw));
    const y = Math.min(Math.max(p.y, hh), Math.max(hh, toM(size.height) - hh));
    if (x !== p.x || y !== p.y) t.body.setTranslation({ x, y }, true);
  };

  const area = (t: Pick<Tracked, "shape" | "width" | "height">) =>
    t.shape === "circle" ? Math.PI * toM(Math.min(t.width, t.height) / 2) ** 2 : toM(t.width) * toM(t.height);

  function makeCollider(t: Pick<Tracked, "shape" | "width" | "height" | "body" | "mass">, options: BodyOptions) {
    const shape = t.shape === "circle" ? RAPIER.ColliderDesc.ball(toM(Math.min(t.width, t.height) / 2)) : RAPIER.ColliderDesc.cuboid(toM(t.width / 2), toM(t.height / 2));
    const desc = shape
      .setMass(t.mass)
      .setRestitution(options.restitution ?? config.body.restitution)
      .setFriction(options.friction ?? config.body.friction);
    return world.createCollider(desc, t.body);
  }

  function reshape(t: Tracked) {
    if (t.shape === "circle") t.collider.setRadius(toM(Math.min(t.width, t.height) / 2));
    else t.collider.setHalfExtents({ x: toM(t.width / 2), y: toM(t.height / 2) });
    t.collider.setMass(t.mass);
  }

  function resize() {
    const next = measure();
    if (next.width === size.width && next.height === size.height) return;
    size = next;
    buildWalls();
    for (const t of bodies.values()) {
      if (!t.fixedSize && (t.element.offsetWidth !== t.width || t.element.offsetHeight !== t.height)) {
        t.width = t.element.offsetWidth;
        t.height = t.element.offsetHeight;
        reshape(t);
      }
      clampInside(t);
      t.body.wakeUp();
    }
  }

  function snapshot(t: Tracked) {
    const p = t.body.translation();
    return { x: p.x, y: p.y, a: t.body.rotation() };
  }

  // Hovering ideas ride a vertical spring to their height, turning upright on the way. They still bump into the
  // rest, so they shoulder their way out of the pile.
  function hover() {
    const { stiffness, damping } = config.hover;
    for (const t of bodies.values()) {
      if (t.hover === undefined || !t.shown) continue;
      const p = t.body.translation();
      const v = t.body.linvel();
      const y = Math.min(Math.max(t.hover, t.height / 2), size.height - t.height / 2);
      t.body.resetForces(false);
      t.body.addForce({ x: 0, y: t.mass * (stiffness * (toM(y) - p.y) - damping * v.y) }, true);
      t.body.setAngvel(-t.body.rotation() * config.upright, true);
      if (Math.abs(toPx(p.y) - y) < t.height / 2) t.element.dataset.arrived = "";
      else delete t.element.dataset.arrived;
    }
  }

  const overlaps = (t: Tracked, x: number, y: number) =>
    [...bodies.values()].some((o) => {
      if (!o.shown || o === t) return false;
      const p = o.body.translation();
      const reach = (Math.max(t.width, t.height) + Math.max(o.width, o.height)) / 2;
      return Math.abs(toPx(p.x) - x) < reach && Math.abs(toPx(p.y) - y) < reach;
    });

  // Each idea drops in from the top once there's a gap, or after a couple of seconds if the pool is packed.
  function spawnDue() {
    for (const t of bodies.values()) {
      if (t.shown || clock < t.spawnAt) continue;
      if (t.pickSpawn) {
        const y = t.height / 2 + 1;
        const tries = Array.from({ length: 6 }, () => t.width / 2 + Math.random() * Math.max(0, size.width - t.width));
        const x = tries.find((x) => !overlaps(t, x, y));
        if (x === undefined && clock - t.spawnAt < 2000) continue;
        t.body.setTranslation({ x: toM(x ?? tries[0]), y: toM(y) }, false);
        t.body.setLinvel({ x: 0, y: config.rainSpeed }, false);
        t.curr = t.prev = snapshot(t);
      }
      t.shown = true;
      t.body.setEnabled(true);
      t.body.wakeUp();
      t.element.style.opacity = "";
    }
  }

  function clampVelocities() {
    for (const t of bodies.values()) {
      const v = t.body.linvel();
      const speed = Math.hypot(v.x, v.y);
      if (speed > maxV) t.body.setLinvel({ x: (v.x / speed) * maxV, y: (v.y / speed) * maxV }, true);
    }
  }

  function stepOnce() {
    for (const t of bodies.values()) t.prev = t.curr;
    clock += config.timestep * 1000;
    spawnDue();
    hover();
    world.step();
    clampVelocities();
    for (const t of bodies.values()) t.curr = snapshot(t);
  }

  function render(alpha: number) {
    for (const t of bodies.values()) {
      if (!t.shown) continue;
      const x = toPx(t.prev.x + (t.curr.x - t.prev.x) * alpha) - t.width / 2;
      const y = toPx(t.prev.y + (t.curr.y - t.prev.y) * alpha) - t.height / 2;
      const a = t.prev.a + (t.curr.a - t.prev.a) * alpha;
      const transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${a.toFixed(4)}rad)`;
      if (transform === t.drawn) continue;
      t.drawn = transform;
      t.element.style.transform = transform;
    }
  }

  let frame = 0;
  let last = 0;
  let acc = 0;
  let paused = false;
  let hidden = false;
  let offscreen = false;
  let destroyed = false;

  const running = () => !paused && !hidden && !offscreen && !destroyed;

  function tick(now: number) {
    frame = 0;
    if (!running()) return;
    const dt = last ? Math.min((now - last) / 1000, config.timestep * config.maxSubsteps) : config.timestep;
    last = now;
    acc += dt;
    let steps = 0;
    while (acc >= config.timestep && steps < config.maxSubsteps) {
      stepOnce();
      acc -= config.timestep;
      steps++;
    }
    if (steps === config.maxSubsteps) acc = 0;
    render(acc / config.timestep);
    frame = requestAnimationFrame(tick);
  }

  function schedule() {
    if (frame || !running() || !config.autoStart) return;
    last = 0;
    frame = requestAnimationFrame(tick);
  }

  function stopLoop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  const onFocusIn = (e: FocusEvent) => {
    const id = (e.target as Element | null)?.closest<HTMLElement>("[data-body-id]")?.dataset.bodyId;
    const t = id ? bodies.get(id) : undefined;
    if (t && !t.shown) t.spawnAt = clock;
  };
  container.addEventListener("focusin", onFocusIn);
  cleanups.push(() => container.removeEventListener("focusin", onFocusIn));

  if (config.autoPause) {
    const onVisibility = () => {
      hidden = document.visibilityState === "hidden";
      if (hidden) stopLoop();
      else schedule();
    };
    document.addEventListener("visibilitychange", onVisibility);
    cleanups.push(() => document.removeEventListener("visibilitychange", onVisibility));
    if (typeof IntersectionObserver !== "undefined") {
      const observer = new IntersectionObserver(([entry]) => {
        offscreen = !entry.isIntersecting;
        if (offscreen) stopLoop();
        else schedule();
      });
      observer.observe(container);
      cleanups.push(() => observer.disconnect());
    }
  }
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => resize());
    observer.observe(container);
    cleanups.push(() => observer.disconnect());
  }

  size = measure();
  buildWalls();

  const controller = {
    registerBody(id: string, element: HTMLElement, options: BodyOptions = {}) {
      if (bodies.has(id)) return;
      const width = options.width ?? element.offsetWidth;
      const height = options.height ?? element.offsetHeight;
      const spawn = options.spawn ?? { x: size.width / 2, y: height / 2 + 1 };
      const desc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(toM(spawn.x), toM(spawn.y))
        .setRotation((Math.random() - 0.5) * 0.4)
        .setLinearDamping(options.linearDamping ?? config.body.linearDamping)
        .setAngularDamping(options.angularDamping ?? config.body.angularDamping)
        .setCcdEnabled(true);
      const body = world.createRigidBody(desc);
      const tracked = { id, element, body, shape: options.shape ?? "box", width, height, fixedSize: options.width !== undefined } as Tracked;
      tracked.mass = (options.density ?? config.body.density) * area(tracked);
      tracked.collider = makeCollider(tracked, options);
      tracked.prev = tracked.curr = snapshot(tracked);
      tracked.spawnAt = clock + (options.delayMs ?? 0);
      tracked.pickSpawn = !options.spawn;
      tracked.shown = false;
      body.setEnabled(false);
      element.dataset.bodyId = id;
      element.style.opacity = "0";
      bodies.set(id, tracked);
      if (!options.delayMs) spawnDue();
      render(1);
    },

    unregisterBody(id: string) {
      const t = bodies.get(id);
      if (!t) return;
      world.removeRigidBody(t.body);
      bodies.delete(id);
      t.element.style.transform = "";
      t.element.style.opacity = "";
      delete t.element.dataset.bodyId;
      delete t.element.dataset.arrived;
    },

    // The height is where the idea's centre settles, in pixels from the top. Null drops it back into the pile.
    setBodyHover(id: string, y: number | null) {
      const t = bodies.get(id);
      if (!t) return;
      if (y === null) {
        if (t.hover === undefined) return;
        t.hover = undefined;
        t.body.resetForces(false);
        t.body.setGravityScale(1, true);
        delete t.element.dataset.arrived;
        return;
      }
      t.hover = y;
      t.body.setGravityScale(0, true);
    },

    pause() {
      paused = true;
      stopLoop();
    },

    resume() {
      paused = false;
      schedule();
    },

    resize,

    get size() {
      return { ...size };
    },

    // Runs the simulation synchronously, for tests and for settling without a frame loop.
    advance(seconds: number) {
      const steps = Math.round(seconds / config.timestep);
      for (let i = 0; i < steps; i++) stepOnce();
      render(1);
    },

    bodyState(id: string) {
      const t = bodies.get(id);
      if (!t) return undefined;
      const p = t.body.translation();
      const v = t.body.linvel();
      return { x: toPx(p.x), y: toPx(p.y), angle: t.body.rotation(), vx: toPx(v.x), vy: toPx(v.y), sleeping: t.body.isSleeping(), shown: t.shown };
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      for (const id of [...bodies.keys()]) controller.unregisterBody(id);
      for (const cleanup of cleanups) cleanup();
      world.free();
    },
  };

  schedule();
  return controller;
}
