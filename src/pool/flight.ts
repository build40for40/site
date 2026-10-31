export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

// The join form announces each problem it sends, with the box it folded into, or null when it didn't fold.
export const SENT = "problem-sent";

// Anything that brings the day box back asks the join form to close first.
export const JOIN_CLOSE = "join-close";

// Dev only: the tweak bar asks for a test send through the form, or for one fewer idea on the days or in the pool.
export const DEV_SEND = "dev-send";
export const DEV_FEWER = "dev-fewer";

export interface SentProblem {
  id?: string;
  problem: string;
  name: string;
  amount: number;
  from: Box | null;
  test?: boolean;
}

const place = ({ left, top, width, height }: Box) => ({ left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });

// The box slides to its target while a separate lift bobs it up and back down, so it travels on a curve.
function travel(element: HTMLElement, from: Box, to: Box, { duration, easing, lift, peak, spin }: { duration: number; easing: string; lift: number; peak: number; spin: number }) {
  const options = { duration, fill: "forwards" } as const;
  const moves = [
    element.animate([place(from), place(to)], { ...options, easing }),
    element.animate(
      [
        { translate: "0 0", easing: "cubic-bezier(.3,.7,.5,1)" },
        { translate: `0 ${-lift}px`, offset: peak, easing: "cubic-bezier(.5,0,.7,.3)" },
        { translate: "0 0" },
      ],
      options,
    ),
    element.animate([{ rotate: "0deg" }, { rotate: `${spin}rad` }], { ...options, easing: "ease-in" }),
  ];
  return Promise.all(moves.map((m) => m.finished)).then(() => undefined);
}

const distance = (from: Box, to: Box) => Math.hypot(to.left - from.left, to.top - from.top);

export const CURL_TURN = -3.5;

// The box curls up where it is into a ball of the given size, ready to be dropped. Its words fade out and the ball's
// artwork fades in.
export function curl(element: HTMLElement, from: Box, size: number, artwork: Element) {
  const options = { duration: 420, fill: "forwards" } as const;
  const ball = { left: from.left + (from.width - size) / 2, top: from.top + (from.height - size) / 2, width: size, height: size };
  for (const child of element.children) child.animate([{ opacity: 1 }, { opacity: 0, offset: 0.35 }, { opacity: 0 }], options);
  element.append(artwork);
  const moves = [
    artwork.animate([{ opacity: 0 }, { opacity: 0, offset: 0.25 }, { opacity: 1 }], options),
    element.animate([{ ...place(from), borderRadius: "6px" }, { ...place(ball), borderRadius: "50%" }], { ...options, easing: "cubic-bezier(.34,1.56,.64,1)" }),
    element.animate([{ rotate: "0rad" }, { rotate: `${CURL_TURN}rad` }], { ...options, easing: "ease-in-out" }),
  ];
  return Promise.all(moves.map((m) => m.finished)).then(() => ball);
}

// The box slides over from where it was, now that the layout has it somewhere else, waiting there until its turn.
export function shift(element: Element, from: Box, delay = 0) {
  const to = boxOf(element);
  return element.animate([{ translate: `${from.left - to.left}px ${from.top - to.top}px` }, { translate: "0 0" }], {
    duration: 700,
    delay,
    easing: "cubic-bezier(.65,0,.35,1)",
    fill: "backwards",
  }).finished;
}

// The box crouches, then jumps up out of its slot like a platformer hero, slowing to a hang at the top. It never
// jumps off the top of the screen.
export function pop(element: HTMLElement, from: Box) {
  const height = Math.max(0, Math.min(from.height * 1.6, from.top - 8));
  const options = { duration: 620, fill: "forwards" } as const;
  element.style.transformOrigin = "50% 100%";
  const moves = [
    element.animate(
      [
        { top: `${from.top}px` },
        { top: `${from.top}px`, offset: 0.22, easing: "cubic-bezier(.15,.75,.35,1)" },
        { top: `${from.top - height}px` },
      ],
      options,
    ),
    element.animate(
      [
        { scale: "1 1", easing: "ease-out" },
        { scale: "1.15 0.8", offset: 0.22, easing: "ease-out" },
        { scale: "0.88 1.18", offset: 0.42, easing: "ease-in-out" },
        { scale: "1 1" },
      ],
      options,
    ),
  ];
  return Promise.all(moves.map((m) => m.finished)).then(() => undefined);
}

// A lob across the page that lands square in its slot, arcing no higher than the top of the screen.
export function lob(element: HTMLElement, from: Box, to: Box) {
  const lift = Math.max(0, Math.min(90, Math.min(from.top, to.top) - 8));
  return travel(element, from, to, { duration: 560 + Math.sqrt(distance(from, to)) * 12, easing: "cubic-bezier(.45,0,.4,1)", lift, peak: 0.45, spin: 0 });
}

export const boxOf = (element: Element): Box => {
  const { left, top, width, height } = element.getBoundingClientRect();
  return { left, top, width, height };
};

// The element folds up and away to nothing, taking the gap after it with it, or unfolds back out of nowhere.
export async function fold(element: HTMLElement, open: boolean, gap = 16) {
  const shown = { height: `${element.scrollHeight}px`, marginBottom: "0px", opacity: 1, translate: "0 0" };
  const folded = { height: "0px", marginBottom: `${-gap}px`, opacity: 0, translate: "0 -40px" };
  element.style.overflow = "hidden";
  await element.animate(open ? [folded, shown] : [shown, folded], { duration: 480, easing: "cubic-bezier(.65,0,.35,1)" }).finished;
  element.style.overflow = "";
}

// The element grows back into its slot from wherever its stand-in was, tilted the way the stand-in was.
export function settle(element: Element, from: Box & { angle?: number }, delay = 0) {
  const to = boxOf(element);
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  return element.animate(
    [
      { translate: `${dx}px ${dy}px`, scale: `${from.width / to.width} ${from.height / to.height}`, rotate: `${from.angle ?? 0}rad` },
      { translate: "0 0", scale: "1 1", rotate: "0rad" },
    ],
    { duration: 620, delay, easing: "cubic-bezier(.34,1.25,.64,1)", fill: "backwards" },
  ).finished;
}
