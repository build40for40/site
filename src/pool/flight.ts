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

// A lob across the page that lands square in its slot.
export function lob(element: HTMLElement, from: Box, to: Box) {
  return travel(element, from, to, { duration: 560 + Math.sqrt(distance(from, to)) * 12, easing: "cubic-bezier(.45,0,.4,1)", lift: 90, peak: 0.45, spin: 0 });
}

export const boxOf = (element: Element): Box => {
  const { left, top, width, height } = element.getBoundingClientRect();
  return { left, top, width, height };
};
