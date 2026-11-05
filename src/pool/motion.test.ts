import { describe, expect, test, vi } from "vitest";
import { poolConfig } from "./config";
import { createShakeDetector, tiltFrom, toScreen } from "./motion";

const { threshold, hardest, gapMs } = poolConfig.physics.shake;
const { most } = poolConfig.physics.tilt;
const still = { x: 0, y: 0, z: 0 };

describe("toScreen", () => {
  test("flips the phone's y so down is down on the page", () => {
    const { x, y } = toScreen({ x: 1, y: 2 }, 0);
    expect(x).toBeCloseTo(1);
    expect(y).toBeCloseTo(-2);
  });

  test("turns with the screen", () => {
    // Turned to landscape with the top of the phone on the left: up the phone is left on screen, and its right edge is up.
    const left = toScreen({ x: 0, y: 1 }, 90);
    expect(left.x).toBeCloseTo(-1);
    expect(left.y).toBeCloseTo(0);
    expect(toScreen({ x: 1, y: 0 }, 90).y).toBeCloseTo(-1);
    const right = toScreen({ x: 0, y: 1 }, 270);
    expect(right.x).toBeCloseTo(1);
    const upsideDown = toScreen({ x: 1, y: 0 }, 180);
    expect(upsideDown.x).toBeCloseTo(-1);
  });
});

describe("createShakeDetector", () => {
  test("ignores walking about and fires on a real shake, throwing the ideas the other way", () => {
    const onShake = vi.fn();
    const detect = createShakeDetector({ onShake });
    detect({ acceleration: { x: threshold - 1, y: 0, z: 0 }, angle: 0, time: 0 });
    expect(onShake).not.toHaveBeenCalled();

    detect({ acceleration: { x: hardest, y: 0, z: 0 }, angle: 0, time: 10 });
    expect(onShake).toHaveBeenCalledOnce();
    const [direction, strength] = onShake.mock.calls[0];
    expect(direction.x).toBeCloseTo(-1);
    expect(strength).toBe(1);
  });

  test("spaces shakes out so a burst of readings is one throw", () => {
    const onShake = vi.fn();
    const detect = createShakeDetector({ onShake });
    const hard = { x: 0, y: hardest, z: 0 };
    detect({ acceleration: hard, angle: 0, time: 0 });
    detect({ acceleration: hard, angle: 0, time: gapMs / 2 });
    expect(onShake).toHaveBeenCalledTimes(1);
    detect({ acceleration: hard, angle: 0, time: gapMs + 1 });
    expect(onShake).toHaveBeenCalledTimes(2);
  });

  test("takes gravity off by itself when the phone only gives readings with gravity", () => {
    const onShake = vi.fn();
    const detect = createShakeDetector({ onShake });
    const resting = { x: 0, y: 9.81, z: 0 };
    for (let i = 0; i < 20; i++) detect({ acceleration: null, withGravity: resting, angle: 0, time: i * 16 });
    expect(onShake).not.toHaveBeenCalled();
    detect({ acceleration: { x: null, y: null, z: null }, withGravity: { x: hardest * 1.5, y: 9.81, z: 0 }, angle: 0, time: 400 });
    expect(onShake).toHaveBeenCalledOnce();
  });

  test("does nothing without readings", () => {
    const onShake = vi.fn();
    createShakeDetector({ onShake })({ acceleration: null, withGravity: null, angle: 0, time: 0 });
    createShakeDetector({ onShake })({ acceleration: still, angle: 0, time: 0 });
    expect(onShake).not.toHaveBeenCalled();
  });
});

describe("sway", () => {
  test("gentle moves nudge the ideas the other way, scaled by the time between readings", () => {
    const onShake = vi.fn();
    const onSway = vi.fn();
    const detect = createShakeDetector({ onShake, onSway });
    detect({ acceleration: { x: 2, y: 0, z: 0 }, angle: 0, time: 0 });
    detect({ acceleration: { x: 2, y: 0, z: 0 }, angle: 0, time: 20 });
    expect(onShake).not.toHaveBeenCalled();
    expect(onSway).toHaveBeenCalledOnce();
    const [change] = onSway.mock.calls[0];
    expect(change.x).toBeLessThan(0);
    expect(change.x).toBeCloseTo(-2 * 0.02 * poolConfig.physics.sway.gain);
  });

  test("moving the phone down bounces the ideas up the screen, harder than a sideways move", () => {
    const onSway = vi.fn();
    const detect = createShakeDetector({ onShake: vi.fn(), onSway });
    // The phone's y points up the screen, so moving it down is negative y.
    detect({ acceleration: { x: 0, y: -2, z: 0 }, angle: 0, time: 0 });
    detect({ acceleration: { x: 0, y: -2, z: 0 }, angle: 0, time: 20 });
    const [change] = onSway.mock.calls[0];
    expect(change.y).toBeCloseTo(-2 * 0.02 * poolConfig.physics.sway.gain * poolConfig.physics.sway.lift);
  });

  test("ignores the sensor's own jitter", () => {
    const onSway = vi.fn();
    const detect = createShakeDetector({ onShake: vi.fn(), onSway });
    for (let i = 0; i < 10; i++) detect({ acceleration: { x: 0.1, y: -0.1, z: 0.05 }, angle: 0, time: i * 16 });
    expect(onSway).not.toHaveBeenCalled();
  });
});

describe("tiltFrom", () => {
  test("held upright, down is straight down", () => {
    expect(tiltFrom(90, 0, 0)).toBeCloseTo(0);
    expect(tiltFrom(45, 0, 0)).toBeCloseTo(0);
  });

  test("dipping the right edge rolls the ideas right, and the left edge left", () => {
    expect(tiltFrom(60, 20, 0)).toBeGreaterThan(0.15);
    expect(tiltFrom(60, -20, 0)).toBeLessThan(-0.15);
  });

  test("never tips past the most, even sideways or upside down", () => {
    expect(tiltFrom(0, 80, 0)).toBeCloseTo(most);
    expect(Math.abs(tiltFrom(-90, 10, 0))).toBeLessThanOrEqual(most);
  });

  test("lying flat there's no down to read, so it stays upright", () => {
    expect(tiltFrom(2, 3, 0)).toBeCloseTo(0);
  });

  test("turns with a landscape screen", () => {
    // Landscape with the top of the phone on the left, held upright: down is straight down the screen.
    expect(tiltFrom(0, -89, 90)).toBeCloseTo(0, 1);
    // Tipping it about the screen rolls the ideas one way or the other.
    expect(tiltFrom(20, -70, 90)).toBeGreaterThan(0.2);
    expect(tiltFrom(-20, -70, 90)).toBeLessThan(-0.2);
  });
});
