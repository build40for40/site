export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

// The join form announces each problem it sends, with the box it folded into, or null when it didn't fold.
export const SENT = "problem-sent";

export interface SentProblem {
  problem: string;
  name: string;
  sponsoring: boolean;
  from: Box | null;
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

// A short hop, then a fall that speeds up like it's under gravity, rounding off into a ball. The words fade before the
// box gets too small for them.
export function fall(element: HTMLElement, from: Box, to: Box, spin = 0) {
  const duration = 420 + Math.sqrt(distance(from, to)) * 14;
  for (const child of element.children) child.animate([{ opacity: 1 }, { opacity: 1, offset: 0.4 }, { opacity: 0 }], { duration, fill: "forwards" });
  element.animate([{ borderRadius: "6px" }, { borderRadius: "50%" }], { duration, easing: "ease-in", fill: "forwards" });
  return travel(element, from, to, { duration, easing: "cubic-bezier(.55,0,.9,.55)", lift: 28, peak: 0.2, spin });
}

// A lob across the page that lands square in its slot.
export function lob(element: HTMLElement, from: Box, to: Box) {
  return travel(element, from, to, { duration: 560 + Math.sqrt(distance(from, to)) * 12, easing: "cubic-bezier(.45,0,.4,1)", lift: 90, peak: 0.45, spin: 0 });
}

export const boxOf = (element: Element): Box => {
  const { left, top, width, height } = element.getBoundingClientRect();
  return { left, top, width, height };
};
