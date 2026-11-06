import { poolConfig } from "./config";
import type { Vector } from "./physics";

interface Axes {
  x: number | null;
  y: number | null;
  z: number | null;
}

interface Reading {
  // Without gravity. Some phones leave it out, so it's worked out from the one with gravity instead.
  acceleration?: Axes | null;
  withGravity?: Axes | null;
  // How far the screen is turned from the phone's natural way up, in degrees.
  angle: number;
  time: number;
}

type Full = { x: number; y: number; z: number };
const full = (a?: Axes | null): Full | undefined => (a && a.x !== null && a.y !== null && a.z !== null ? (a as Full) : undefined);

// The phone's x points right and its y points up the screen when held its natural way, but the page's y points down.
// A turned screen turns them with it.
export function toScreen({ x, y }: { x: number; y: number }, angle: number): Vector {
  // The screen turns the opposite way to the phone to stay upright, so the phone's axes turn back by its angle.
  const r = (-angle * Math.PI) / 180;
  const down = -y;
  return { x: x * Math.cos(r) - down * Math.sin(r), y: x * Math.sin(r) + down * Math.cos(r) };
}

export interface MotionHandlers {
  // A real shake: the way to throw the ideas, as a unit vector on screen, and how hard from 0 to 1.
  onShake: (direction: Vector, strength: number) => void;
  // Anything gentler: the change in speed the ideas would feel, in metres per second on screen.
  onSway?: (change: Vector) => void;
  // How far the pool is tipped from upright, in radians. Positive rolls the ideas right.
  onTilt?: (angle: number) => void;
}

export function createShakeDetector({ onShake, onSway }: MotionHandlers) {
  const { threshold, hardest, gapMs } = poolConfig.physics.shake;
  const { deadzone, gain, lift, maxStepMs } = poolConfig.physics.sway;
  let gravity: Full | undefined;
  let last = -Infinity;
  let previous: number | undefined;

  return ({ acceleration, withGravity, angle, time }: Reading) => {
    const dt = previous === undefined ? 0 : Math.min(Math.max(time - previous, 0), maxStepMs) / 1000;
    previous = time;
    let a = full(acceleration);
    if (!a) {
      const g = full(withGravity);
      if (!g) return;
      // Gravity barely changes from one reading to the next, so a slow average of it is gravity and the rest is the shake.
      gravity = gravity ? { x: gravity.x * 0.8 + g.x * 0.2, y: gravity.y * 0.8 + g.y * 0.2, z: gravity.z * 0.8 + g.z * 0.2 } : g;
      a = { x: g.x - gravity.x, y: g.y - gravity.y, z: g.z - gravity.z };
    }
    const size = Math.hypot(a.x, a.y, a.z);
    const flat = toScreen(a, angle);
    if (size < threshold) {
      // The ideas lag behind the phone, so they drift the opposite way to it.
      if (size >= deadzone && dt) onSway?.({ x: -flat.x * dt * gain, y: -flat.y * dt * gain * lift });
      return;
    }
    if (time - last < gapMs) return;
    last = time;
    const length = Math.hypot(flat.x, flat.y);
    const strength = Math.min(1, (size - threshold) / (hardest - threshold));
    onShake(length ? { x: -flat.x / length, y: -flat.y / length } : { x: 0, y: 0 }, strength);
  };
}

// Which way is down on screen, from how the phone is tipped forward (beta) and sideways (gamma) in degrees, as an angle
// from straight down the screen. Lying flat there's no down to speak of, so it fades back to upright, and it never tips
// past most, so the ideas always stay in the pool.
export function tiltFrom(beta: number, gamma: number, angle: number) {
  const { gain, most, flat } = poolConfig.physics.tilt;
  const b = (beta * Math.PI) / 180;
  const g = (gamma * Math.PI) / 180;
  const down = toScreen({ x: Math.cos(b) * Math.sin(g), y: -Math.sin(b) }, angle);
  const lean = Math.hypot(down.x, down.y);
  const sure = Math.min(Math.max((lean - flat[0]) / (flat[1] - flat[0]), 0), 1);
  const tip = Math.atan2(down.x, Math.max(down.y, 0.001));
  return Math.min(Math.max(tip * gain, -most), most) * sure;
}

type Asking = { requestPermission?: () => Promise<"granted" | "denied"> };
const sensor = () => (typeof DeviceMotionEvent === "undefined" ? undefined : (DeviceMotionEvent as unknown as Asking));

// Laptops have the event too but never fire it, so only touch screens count.
export const canShake = () => !!sensor() && matchMedia("(pointer: coarse)").matches;

// Chrome says yes straight away, while iPhones only ask when it's called straight from a tap, before any await, and
// refuse quietly otherwise.
export async function ask() {
  const turning = typeof DeviceOrientationEvent === "undefined" ? undefined : (DeviceOrientationEvent as unknown as Asking);
  // Both start before any await, so they both count as coming from the tap.
  const asks = [sensor(), turning].map((s) => (s?.requestPermission ? s.requestPermission().catch(() => "denied") : Promise.resolve("granted")));
  const [motion] = await Promise.all(asks);
  return motion === "granted";
}

const turned = () => screen.orientation?.angle ?? 0;

export function listen(handlers: MotionHandlers) {
  const detect = createShakeDetector(handlers);
  const moved = (e: DeviceMotionEvent) =>
    detect({ acceleration: e.acceleration, withGravity: e.accelerationIncludingGravity, angle: turned(), time: e.timeStamp });
  // Orientation readings jitter, so the tilt follows a smoothed copy of them.
  let tilt = 0;
  const turnedPhone = (e: DeviceOrientationEvent) => {
    if (e.beta === null || e.gamma === null) return;
    tilt += (tiltFrom(e.beta, e.gamma, turned()) - tilt) * poolConfig.physics.tilt.smoothing;
    handlers.onTilt?.(tilt);
  };
  addEventListener("devicemotion", moved);
  addEventListener("deviceorientation", turnedPhone);
  return () => {
    removeEventListener("devicemotion", moved);
    removeEventListener("deviceorientation", turnedPhone);
    handlers.onTilt?.(0);
  };
}

// Whether the person switched shaking on or off last time. Undefined if they never touched it.
const KEY = "pool-shake";
export function saved() {
  try {
    const value = localStorage.getItem(KEY);
    return value === "on" ? true : value === "off" ? false : undefined;
  } catch {
    return undefined;
  }
}

export function save(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {}
}
