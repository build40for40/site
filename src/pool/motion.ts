import { poolConfig } from "./config";

export interface Vector {
  x: number;
  y: number;
}

export interface Tilt {
  beta: number;
  gamma: number;
}

export type MotionPermission = "granted" | "denied" | "unsupported";

const rad = (deg: number) => (deg * Math.PI) / 180;

// The neutral pose gives normal downward gravity, and tilting away from it steers gravity in screen space.
export function tiltToGravity(tilt: Tilt, neutral: Tilt, screenAngle: number, gravity: number, { strength = poolConfig.motion.tiltStrength, max = poolConfig.motion.maxGravity } = {}): Vector {
  const g = Math.sin(rad(tilt.gamma - neutral.gamma)) * strength;
  const b = Math.sin(rad(tilt.beta - neutral.beta)) * strength;
  const angle = ((Math.round(screenAngle / 90) * 90) % 360 + 360) % 360;
  const [sx, sy] = { 0: [g, b], 90: [b, -g], 180: [-g, -b], 270: [-b, g] }[angle as 0 | 90 | 180 | 270];
  let x = gravity * sx;
  let y = gravity * (1 + sy);
  const length = Math.hypot(x, y);
  if (length > max) {
    x = (x / length) * max;
    y = (y / length) * max;
  }
  return { x, y };
}

export function smoother(alpha = poolConfig.motion.smoothing) {
  let last: Tilt | undefined;
  return (tilt: Tilt) => {
    last = last ? { beta: last.beta + (tilt.beta - last.beta) * alpha, gamma: last.gamma + (tilt.gamma - last.gamma) * alpha } : tilt;
    return last;
  };
}

type ShakeOptions = typeof poolConfig.motion.shake;

// Returns an impulse size when enough hard jolts land close together, then stays quiet for the cooldown.
export function shakeDetector({ threshold, hits, windowMs, cooldownMs, impulse, maxImpulse }: ShakeOptions = poolConfig.motion.shake) {
  let jolts: number[] = [];
  let peak = 0;
  let quietUntil = 0;
  return (acceleration: Vector & { z?: number }, now: number): number | null => {
    if (now < quietUntil) return null;
    const force = Math.hypot(acceleration.x, acceleration.y, acceleration.z ?? 0);
    if (force < threshold) return null;
    jolts = [...jolts.filter((t) => now - t < windowMs), now];
    peak = Math.max(peak, force);
    if (jolts.length < hits) return null;
    const size = Math.min(maxImpulse, impulse * (peak / threshold));
    jolts = [];
    peak = 0;
    quietUntil = now + cooldownMs;
    return size;
  };
}

type PermissionApi = { requestPermission?: () => Promise<"granted" | "denied"> };

export const motionSupported = (win: Window & typeof globalThis = window) => "DeviceOrientationEvent" in win;

// iOS Safari only asks from a tap, and only on https.
export async function requestMotionPermission(win: Window & typeof globalThis = window): Promise<MotionPermission> {
  if (!motionSupported(win) || !win.isSecureContext) return "unsupported";
  const orientation = win.DeviceOrientationEvent as unknown as PermissionApi;
  const motion = (win as unknown as { DeviceMotionEvent?: PermissionApi }).DeviceMotionEvent;
  if (typeof orientation.requestPermission !== "function") return "granted";
  try {
    const answers = await Promise.all([orientation.requestPermission(), motion?.requestPermission?.() ?? "granted"]);
    return answers.every((a) => a === "granted") ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

interface MotionHandlers {
  onTilt: (tilt: Tilt, screenAngle: number) => void;
  onShake: (size: number) => void;
}

export function listenToMotion({ onTilt, onShake }: MotionHandlers, win: Window & typeof globalThis = window) {
  const smooth = smoother();
  const shake = shakeDetector();
  const angle = () => win.screen?.orientation?.angle ?? 0;
  const orientation = (e: DeviceOrientationEvent) => {
    if (e.beta === null || e.gamma === null) return;
    onTilt(smooth({ beta: e.beta, gamma: e.gamma }), angle());
  };
  const motion = (e: DeviceMotionEvent) => {
    const a = e.acceleration;
    if (!a || a.x === null || a.y === null) return;
    const size = shake({ x: a.x, y: a.y, z: a.z ?? 0 }, e.timeStamp);
    if (size) onShake(size);
  };
  win.addEventListener("deviceorientation", orientation);
  win.addEventListener("devicemotion", motion);
  return () => {
    win.removeEventListener("deviceorientation", orientation);
    win.removeEventListener("devicemotion", motion);
  };
}
