import * as RAPIER from "@dimforge/rapier2d";
import { poolConfig } from "./config";
import { listenToMotion, tiltToGravity, type Tilt, type Vector } from "./motion";

type Config = typeof poolConfig.physics & {
  autoStart?: boolean;
  autoPause?: boolean;
  motion?: typeof poolConfig.motion;
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

interface TargetOptions {
  mode?: "spring" | "force";
  stiffness?: number;
  damping?: number;
  strength?: number;
  durationMs?: number;
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
  fixedSize: boolean;
  prev: Pose;
  curr: Pose;
  spawnAt: number;
  pickSpawn: boolean;
  shown: boolean;
  drawn?: string;
  target?: { anchor?: RAPIER.RigidBody; joint?: RAPIER.ImpulseJoint; force?: Vector; strength: number; until: number };
}

interface Grab {
  id: string;
  pointerType: string;
  startX: number;
  startY: number;
  timer?: ReturnType<typeof setTimeout>;
  anchor?: RAPIER.RigidBody;
  joint?: RAPIER.ImpulseJoint;
  last: Vector;
}

export type PhysicsController = ReturnType<typeof initializePhysics>;

export function initializePhysics(container: HTMLElement, overrides: Partial<Config> = {}) {
  const config: Config = { ...poolConfig.physics, autoStart: true, autoPause: true, motion: poolConfig.motion, ...overrides };
  const scale = config.pxPerMeter;
  const toM = (px: number) => px / scale;
  const toPx = (m: number) => m * scale;

  const world = new RAPIER.World({ x: config.gravity.x, y: config.gravity.y });
  world.timestep = config.timestep;
  const bodies = new Map<string, Tracked>();
  const grabs = new Map<number, Grab>();
  const cleanups: (() => void)[] = [];
  const baseGravity: Vector = { ...config.gravity };
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

  function makeCollider(t: Pick<Tracked, "shape" | "width" | "height" | "body">, options: BodyOptions) {
    const shape = t.shape === "circle" ? RAPIER.ColliderDesc.ball(toM(Math.min(t.width, t.height) / 2)) : RAPIER.ColliderDesc.cuboid(toM(t.width / 2), toM(t.height / 2));
    const desc = shape
      .setDensity(options.density ?? config.body.density)
      .setRestitution(options.restitution ?? config.body.restitution)
      .setFriction(options.friction ?? config.body.friction);
    return world.createCollider(desc, t.body);
  }

  function resize() {
    const next = measure();
    if (next.width === size.width && next.height === size.height) return;
    size = next;
    buildWalls();
    for (const t of bodies.values()) {
      if (!t.fixedSize && (t.element.offsetWidth !== t.width || t.element.offsetHeight !== t.height)) {
        world.removeCollider(t.collider, false);
        t.width = t.element.offsetWidth;
        t.height = t.element.offsetHeight;
        t.collider = makeCollider(t, {});
      }
      clampInside(t);
      t.body.wakeUp();
    }
  }

  function snapshot(t: Tracked) {
    const p = t.body.translation();
    return { x: p.x, y: p.y, a: t.body.rotation() };
  }

  let pointerOn = false;

  function applyTargets() {
    for (const t of bodies.values()) {
      const target = t.target;
      if (!target?.force) continue;
      t.body.resetForces(false);
      if (clock > target.until) {
        t.target = undefined;
        continue;
      }
      const p = t.body.translation();
      const dx = target.force.x - p.x;
      const dy = target.force.y - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      const mass = t.body.mass();
      t.body.addForce({ x: (dx / dist) * target.strength * mass, y: (dy / dist) * target.strength * mass }, true);
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
    applyTargets();
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

  // Pointer events: push with the mouse, drag and throw with mouse or touch.
  const local = (e: PointerEvent): Vector => {
    const rect = container.getBoundingClientRect();
    return { x: toM(e.clientX - rect.left), y: toM(e.clientY - rect.top) };
  };

  function startDrag(pointerId: number, grab: Grab, at: Vector) {
    const t = bodies.get(grab.id);
    if (!t || grab.anchor) return;
    clearTimeout(grab.timer);
    const p = t.body.translation();
    const angle = t.body.rotation();
    const dx = at.x - p.x;
    const dy = at.y - p.y;
    const anchorPoint = { x: dx * Math.cos(-angle) - dy * Math.sin(-angle), y: dx * Math.sin(-angle) + dy * Math.cos(-angle) };
    grab.anchor = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(at.x, at.y));
    const m = t.body.mass();
    grab.joint = world.createImpulseJoint(RAPIER.JointData.spring(0, config.drag.stiffness * m, config.drag.damping * m, { x: 0, y: 0 }, anchorPoint), grab.anchor, t.body, true);
    t.body.wakeUp();
    container.setPointerCapture?.(pointerId);
    t.element.dataset.dragging = "";
  }

  function endGrab(pointerId: number) {
    const grab = grabs.get(pointerId);
    if (!grab) return;
    clearTimeout(grab.timer);
    grabs.delete(pointerId);
    if (!grab.anchor) return;
    if (grab.joint) world.removeImpulseJoint(grab.joint, true);
    world.removeRigidBody(grab.anchor);
    const t = bodies.get(grab.id);
    if (t) delete t.element.dataset.dragging;
    // The drag ends in a click on the same element, which must not open the idea.
    const swallow = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    container.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => container.removeEventListener("click", swallow, { capture: true }), 0);
  }

  const onPointerDown = (e: PointerEvent) => {
    if (!pointerOn || e.button > 0) return;
    const element = (e.target as Element | null)?.closest<HTMLElement>("[data-body-id]");
    const id = element?.dataset.bodyId;
    if (!id || !bodies.has(id)) return;
    const at = local(e);
    const grab: Grab = { id, pointerType: e.pointerType, startX: e.clientX, startY: e.clientY, last: at };
    grabs.set(e.pointerId, grab);
    // Touches only grab after a sideways move or a long press, so vertical swipes still scroll the page.
    if (e.pointerType === "touch") grab.timer = setTimeout(() => startDrag(e.pointerId, grab, grab.last), config.drag.longPressMs);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!pointerOn) return;
    const grab = grabs.get(e.pointerId);
    if (!grab) return;
    const at = local(e);
    grab.last = at;
    if (grab.anchor) {
      grab.anchor.setNextKinematicTranslation(at);
      return;
    }
    const dx = e.clientX - grab.startX;
    const dy = e.clientY - grab.startY;
    const far = Math.hypot(dx, dy) > config.drag.threshold;
    if (grab.pointerType === "touch" ? far && Math.abs(dx) > Math.abs(dy) : far) startDrag(e.pointerId, grab, at);
  };

  const onPointerEnd = (e: PointerEvent) => endGrab(e.pointerId);
  const onTouchMove = (e: TouchEvent) => {
    if ([...grabs.values()].some((g) => g.anchor)) e.preventDefault();
  };
  const onFocusIn = (e: FocusEvent) => {
    const id = (e.target as Element | null)?.closest<HTMLElement>("[data-body-id]")?.dataset.bodyId;
    const t = id ? bodies.get(id) : undefined;
    if (t && !t.shown) t.spawnAt = clock;
  };

  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerup", onPointerEnd);
  container.addEventListener("pointercancel", onPointerEnd);
  container.addEventListener("touchmove", onTouchMove, { passive: false });
  container.addEventListener("focusin", onFocusIn);
  cleanups.push(() => {
    container.removeEventListener("pointerdown", onPointerDown);
    container.removeEventListener("pointermove", onPointerMove);
    container.removeEventListener("pointerup", onPointerEnd);
    container.removeEventListener("pointercancel", onPointerEnd);
    container.removeEventListener("touchmove", onTouchMove);
    container.removeEventListener("focusin", onFocusIn);
  });

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

  let stopMotion: (() => void) | undefined;
  let latestTilt: Tilt | undefined;
  let neutral: Tilt | undefined;

  const removeTarget = (t: Tracked) => {
    if (t.target?.joint) {
      world.removeImpulseJoint(t.target.joint, true);
      t.body.setGravityScale(1, true);
    }
    if (t.target?.anchor) world.removeRigidBody(t.target.anchor);
    if (t.target?.force) t.body.resetForces(true);
    t.target = undefined;
  };

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
      for (const [pointerId, grab] of grabs) if (grab.id === id) endGrab(pointerId);
      removeTarget(t);
      world.removeRigidBody(t.body);
      bodies.delete(id);
      t.element.style.transform = "";
      t.element.style.opacity = "";
      delete t.element.dataset.bodyId;
    },

    setGravity(vector: Vector) {
      world.gravity = { x: vector.x, y: vector.y };
      for (const t of bodies.values()) t.body.wakeUp();
    },

    // Vectors are a change in velocity, in metres per second, so heavy and light ideas move alike.
    applyImpulse(id: string, vector: Vector) {
      const t = bodies.get(id);
      if (!t?.shown) return;
      const m = t.body.mass();
      t.body.applyImpulse({ x: vector.x * m, y: vector.y * m }, true);
    },

    applyImpulseToAll(vector: Vector, { jitter = 0 } = {}) {
      for (const t of bodies.values()) {
        controller.applyImpulse(t.id, { x: vector.x + (Math.random() - 0.5) * jitter, y: vector.y + (Math.random() - 0.5) * jitter });
      }
    },

    wake(id: string) {
      bodies.get(id)?.body.wakeUp();
    },

    setBodyGravityScale(id: string, gravityScale: number) {
      bodies.get(id)?.body.setGravityScale(gravityScale, true);
    },

    // Targets are in pixels, and spring settings are per kilogram. Springs pull through a joint and forces push
    // each step, so ideas keep colliding on the way.
    setBodyTarget(id: string, target: Vector | null, options: TargetOptions = {}) {
      const t = bodies.get(id);
      if (!t) return;
      removeTarget(t);
      if (!target) return;
      const at = { x: toM(target.x), y: toM(target.y) };
      if ((options.mode ?? "spring") === "spring") {
        const anchor = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(at.x, at.y));
        const m = t.body.mass();
        const spring = RAPIER.JointData.spring(0, (options.stiffness ?? 40) * m, (options.damping ?? 10) * m, { x: 0, y: 0 }, { x: 0, y: 0 });
        const joint = world.createImpulseJoint(spring, anchor, t.body, true);
        // Without this, gravity would leave the idea hanging below its target.
        t.body.setGravityScale(0, true);
        t.target = { anchor, joint, strength: 0, until: Infinity };
      } else {
        t.target = { force: at, strength: options.strength ?? 40, until: clock + (options.durationMs ?? 2000) };
      }
      t.body.wakeUp();
    },

    enablePointerInteraction(enabled: boolean) {
      pointerOn = enabled;
      if (!enabled) {
        for (const pointerId of [...grabs.keys()]) endGrab(pointerId);
      }
    },

    // Call only after requestMotionPermission() has said yes.
    enableDeviceMotion(enabled: boolean) {
      stopMotion?.();
      stopMotion = undefined;
      if (!enabled) {
        controller.setGravity(baseGravity);
        return;
      }
      const g = Math.hypot(baseGravity.x, baseGravity.y);
      stopMotion = listenToMotion({
        onTilt(tilt, angle) {
          latestTilt = tilt;
          neutral ??= tilt;
          controller.setGravity(tiltToGravity(tilt, neutral, angle, g, { strength: config.motion?.tiltStrength, max: config.motion?.maxGravity }));
        },
        onShake(size) {
          for (const t of bodies.values()) {
            const angle = Math.random() * Math.PI * 2;
            controller.applyImpulse(t.id, { x: Math.cos(angle) * size, y: Math.sin(angle) * size - size / 2 });
          }
        },
      });
    },

    calibrateDeviceMotion() {
      if (latestTilt) neutral = latestTilt;
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

    get gravity() {
      return { ...world.gravity };
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      stopMotion?.();
      for (const pointerId of [...grabs.keys()]) endGrab(pointerId);
      for (const id of [...bodies.keys()]) controller.unregisterBody(id);
      for (const cleanup of cleanups) cleanup();
      world.free();
    },
  };

  schedule();
  return controller;
}
