import { describe, expect, test, vi } from "vitest";
import { poolConfig } from "./config";
import { createShakeDetector, toScreen } from "./motion";

const { threshold, hardest, gapMs } = poolConfig.physics.shake;
const still = { x: 0, y: 0, z: 0 };

describe("toScreen", () => {
  test("flips the phone's y so down is down on the page", () => {
    const { x, y } = toScreen({ x: 1, y: 2 }, 0);
    expect(x).toBeCloseTo(1);
    expect(y).toBeCloseTo(-2);
  });

  test("turns with the screen", () => {
    // Turned to landscape with the top of the phone on the left: up the phone is right on screen.
    const left = toScreen({ x: 0, y: 1 }, 90);
    expect(left.x).toBeCloseTo(1);
    expect(left.y).toBeCloseTo(0);
    const right = toScreen({ x: 0, y: 1 }, 270);
    expect(right.x).toBeCloseTo(-1);
    const upsideDown = toScreen({ x: 1, y: 0 }, 180);
    expect(upsideDown.x).toBeCloseTo(-1);
  });
});

describe("createShakeDetector", () => {
  test("ignores walking about and fires on a real shake, throwing the ideas the other way", () => {
    const onShake = vi.fn();
    const detect = createShakeDetector(onShake);
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
    const detect = createShakeDetector(onShake);
    const hard = { x: 0, y: hardest, z: 0 };
    detect({ acceleration: hard, angle: 0, time: 0 });
    detect({ acceleration: hard, angle: 0, time: gapMs / 2 });
    expect(onShake).toHaveBeenCalledTimes(1);
    detect({ acceleration: hard, angle: 0, time: gapMs + 1 });
    expect(onShake).toHaveBeenCalledTimes(2);
  });

  test("takes gravity off by itself when the phone only gives readings with gravity", () => {
    const onShake = vi.fn();
    const detect = createShakeDetector(onShake);
    const resting = { x: 0, y: 9.81, z: 0 };
    for (let i = 0; i < 20; i++) detect({ acceleration: null, withGravity: resting, angle: 0, time: i * 16 });
    expect(onShake).not.toHaveBeenCalled();
    detect({ acceleration: { x: null, y: null, z: null }, withGravity: { x: hardest * 1.5, y: 9.81, z: 0 }, angle: 0, time: 400 });
    expect(onShake).toHaveBeenCalledOnce();
  });

  test("does nothing without readings", () => {
    const onShake = vi.fn();
    createShakeDetector(onShake)({ acceleration: null, withGravity: null, angle: 0, time: 0 });
    createShakeDetector(onShake)({ acceleration: still, angle: 0, time: 0 });
    expect(onShake).not.toHaveBeenCalled();
  });
});
