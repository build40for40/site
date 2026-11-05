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
  const r = (angle * Math.PI) / 180;
  const down = -y;
  return { x: x * Math.cos(r) - down * Math.sin(r), y: x * Math.sin(r) + down * Math.cos(r) };
}

// Calls back with the way to throw the ideas, as a unit vector on screen, and how hard from 0 to 1.
export function createShakeDetector(onShake: (direction: Vector, strength: number) => void) {
  const { threshold, hardest, gapMs } = poolConfig.physics.shake;
  let gravity: Full | undefined;
  let last = -Infinity;

  return ({ acceleration, withGravity, angle, time }: Reading) => {
    let a = full(acceleration);
    if (!a) {
      const g = full(withGravity);
      if (!g) return;
      // Gravity barely changes from one reading to the next, so a slow average of it is gravity and the rest is the shake.
      gravity = gravity ? { x: gravity.x * 0.8 + g.x * 0.2, y: gravity.y * 0.8 + g.y * 0.2, z: gravity.z * 0.8 + g.z * 0.2 } : g;
      a = { x: g.x - gravity.x, y: g.y - gravity.y, z: g.z - gravity.z };
    }
    const size = Math.hypot(a.x, a.y, a.z);
    if (size < threshold || time - last < gapMs) return;
    last = time;
    const flat = toScreen(a, angle);
    const length = Math.hypot(flat.x, flat.y);
    const strength = Math.min(1, (size - threshold) / (hardest - threshold));
    // The ideas lag behind the phone, so they go the opposite way to it.
    onShake(length ? { x: -flat.x / length, y: -flat.y / length } : { x: 0, y: 0 }, strength);
  };
}

type Asking = { requestPermission?: () => Promise<"granted" | "denied"> };
const sensor = () => (typeof DeviceMotionEvent === "undefined" ? undefined : (DeviceMotionEvent as unknown as Asking));

// Laptops have the event too but never fire it, so only touch screens count.
export const canShake = () => !!sensor() && matchMedia("(pointer: coarse)").matches;

// Chrome says yes straight away, while iPhones only ask when it's called straight from a tap, before any await, and
// refuse quietly otherwise.
export async function ask() {
  const asking = sensor();
  if (!asking?.requestPermission) return true;
  try {
    return (await asking.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

export function listen(onShake: (direction: Vector, strength: number) => void) {
  const detect = createShakeDetector(onShake);
  const handler = (e: DeviceMotionEvent) =>
    detect({ acceleration: e.acceleration, withGravity: e.accelerationIncludingGravity, angle: screen.orientation?.angle ?? 0, time: e.timeStamp });
  addEventListener("devicemotion", handler);
  return () => removeEventListener("devicemotion", handler);
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
