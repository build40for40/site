import { describe, expect, test, vi } from "vitest";
import { listenToMotion, requestMotionPermission, shakeDetector, smoother, tiltToGravity } from "./motion";

const neutral = { beta: 40, gamma: 0 };

describe("tiltToGravity", () => {
  test("holding the phone at its neutral angle gives normal gravity", () => {
    expect(tiltToGravity(neutral, neutral, 0, 20)).toEqual({ x: 0, y: 20 });
  });

  test("tilting right pulls ideas right, tilting back slows the fall", () => {
    const right = tiltToGravity({ beta: 40, gamma: 30 }, neutral, 0, 20);
    expect(right.x).toBeGreaterThan(0);
    const back = tiltToGravity({ beta: 20, gamma: 0 }, neutral, 0, 20);
    expect(back.y).toBeLessThan(20);
  });

  test("follows the screen when the phone turns sideways", () => {
    const portrait = tiltToGravity({ beta: 70, gamma: 0 }, neutral, 0, 20);
    const landscape = tiltToGravity({ beta: 70, gamma: 0 }, neutral, 90, 20);
    expect(portrait.x).toBeCloseTo(0);
    expect(landscape.x).toBeGreaterThan(0);
    expect(tiltToGravity({ beta: 40, gamma: 30 }, neutral, 270, 20).y).toBeGreaterThan(20);
  });

  test("never goes past the cap", () => {
    const g = tiltToGravity({ beta: 130, gamma: 89 }, neutral, 0, 20, { strength: 5, max: 30 });
    expect(Math.hypot(g.x, g.y)).toBeCloseTo(30);
  });
});

test("smoother eases towards new readings", () => {
  const smooth = smoother(0.5);
  smooth({ beta: 0, gamma: 0 });
  expect(smooth({ beta: 10, gamma: -10 })).toEqual({ beta: 5, gamma: -5 });
});

describe("shakeDetector", () => {
  const options = { threshold: 15, hits: 3, windowMs: 500, cooldownMs: 1000, impulse: 6, maxImpulse: 10 };
  const jolt = (force: number) => ({ x: force, y: 0, z: 0 });

  test("ignores gentle movement", () => {
    const shake = shakeDetector(options);
    expect([0, 50, 100, 150].map((t) => shake(jolt(10), t))).toEqual([null, null, null, null]);
  });

  test("fires after enough hard jolts close together, then cools down", () => {
    const shake = shakeDetector(options);
    expect(shake(jolt(20), 0)).toBeNull();
    expect(shake(jolt(20), 100)).toBeNull();
    expect(shake(jolt(20), 200)).toBeCloseTo(8);
    expect(shake(jolt(20), 300)).toBeNull();
    for (const t of [1300, 1350]) shake(jolt(20), t);
    expect(shake(jolt(20), 1400)).not.toBeNull();
  });

  test("spread out jolts don't count", () => {
    const shake = shakeDetector(options);
    expect([0, 600, 1200].map((t) => shake(jolt(20), t))).toEqual([null, null, null]);
  });

  test("caps the impulse", () => {
    const shake = shakeDetector(options);
    shake(jolt(100), 0);
    shake(jolt(100), 10);
    expect(shake(jolt(100), 20)).toBe(10);
  });
});

describe("requestMotionPermission", () => {
  const win = (extra: object) => ({ isSecureContext: true, ...extra }) as unknown as Window & typeof globalThis;

  test("no sensors means unsupported", async () => {
    expect(await requestMotionPermission(win({}))).toBe("unsupported");
  });

  test("needs a secure context", async () => {
    expect(await requestMotionPermission(win({ DeviceOrientationEvent: class {}, isSecureContext: false }))).toBe("unsupported");
  });

  test("browsers without a prompt are allowed straight away", async () => {
    expect(await requestMotionPermission(win({ DeviceOrientationEvent: class {} }))).toBe("granted");
  });

  test("asks for both sensors where the browser prompts", async () => {
    const orientation = vi.fn(async () => "granted");
    const motion = vi.fn(async () => "granted");
    const result = await requestMotionPermission(
      win({ DeviceOrientationEvent: { requestPermission: orientation }, DeviceMotionEvent: { requestPermission: motion } }),
    );
    expect(result).toBe("granted");
    expect(orientation).toHaveBeenCalledOnce();
    expect(motion).toHaveBeenCalledOnce();
  });

  test("a no, or a prompt that throws, is a denial", async () => {
    expect(await requestMotionPermission(win({ DeviceOrientationEvent: { requestPermission: async () => "denied" } }))).toBe("denied");
    expect(await requestMotionPermission(win({ DeviceOrientationEvent: { requestPermission: () => Promise.reject(new Error("no gesture")) } }))).toBe("denied");
  });
});

describe("listenToMotion", () => {
  const fakeWindow = (angle = 0) => Object.assign(new EventTarget(), { screen: { orientation: { angle } } }) as unknown as Window & typeof globalThis;
  const event = (type: string, props: object) =>
    Object.defineProperties(new Event(type), Object.fromEntries(Object.entries(props).map(([key, value]) => [key, { value }])));

  test("passes on tilt and shakes, and stops cleanly", () => {
    const win = fakeWindow(90);
    const onTilt = vi.fn();
    const onShake = vi.fn();
    const stop = listenToMotion({ onTilt, onShake }, win);

    win.dispatchEvent(event("deviceorientation", { beta: 10, gamma: 5 }));
    expect(onTilt).toHaveBeenCalledWith({ beta: 10, gamma: 5 }, 90);

    for (let i = 0; i < 3; i++) win.dispatchEvent(event("devicemotion", { acceleration: { x: 40, y: 0, z: 0 }, timeStamp: i * 50 }));
    expect(onShake).toHaveBeenCalledOnce();

    stop();
    win.dispatchEvent(event("deviceorientation", { beta: 20, gamma: 5 }));
    expect(onTilt).toHaveBeenCalledOnce();
  });

  test("a device with no sensor readings does nothing", () => {
    const win = fakeWindow();
    const onTilt = vi.fn();
    listenToMotion({ onTilt, onShake: vi.fn() }, win);
    win.dispatchEvent(event("deviceorientation", { beta: null, gamma: null }));
    win.dispatchEvent(event("devicemotion", { acceleration: null }));
    expect(onTilt).not.toHaveBeenCalled();
  });
});
