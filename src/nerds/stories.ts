// Story of the day: a short read where one view changes as you scroll.
// Every claim here comes from fashion.json; the quotes are Wikipedia's.

export interface Story {
  id: string;
  kicker: string;
  title: string;
  dek: string;
  view: string;
  steps: { text: string; params: Record<string, string> }[];
}

export const STORIES: Story[] = [
  {
    id: "flares",
    kicker: "Comebacks",
    title: "Your mum's flares are back, and here's the maths",
    dek: "Bell-bottoms have come back three times. The gaps aren't random.",
    view: "strings",
    steps: [
      { text: "Bell-bottoms first swing into Paris in 1964, then take over everyone's legs until the early 80s.", params: { trend: "bell-bottoms", year: "1964" } },
      { text: "Grunge drags them back out of the loft. Wikipedia puts 1970s bell-bottom jeans popular again by 1992, about 22 years on.", params: { trend: "bell-bottoms", year: "1992" } },
      { text: "Then 2021 hits and flares are everywhere again. Across all 183 comebacks we've found, the typical gap is about 33 years.", params: { trend: "bell-bottoms", year: "2021" } },
      { text: "Every thread on this clock is a trend that came back. Tap one and see how long it hid in the wardrobe.", params: { trend: "", year: "" } },
    ],
  },
  {
    id: "waist",
    kicker: "Shapes",
    title: "The waist went on holiday for a hundred years",
    dek: "Where women were told to have a waist moved more than the hemline did.",
    view: "silhouette",
    steps: [
      { text: "1925: the waist drops to the hips and nobody has a figure on purpose. Flappers want a straight line.", params: { year: "1925" } },
      { text: "1947: Dior's New Look snaps it back in, tiny waist, huge skirt, and rationing still on in Britain.", params: { year: "1947" } },
      { text: "1966: the waist stops mattering and the knees come out instead.", params: { year: "1966" } },
      { text: "1986: shoulder pads. The waist is back, but the shoulders are doing all the talking.", params: { year: "1986" } },
      { text: "2002: low rise. The waist is now somewhere around the hip bones and nobody can sit down.", params: { year: "2002" } },
    ],
  },
  {
    id: "late-books",
    kicker: "Words",
    title: "Books are always late to the party",
    dek: "The miniskirt was the 1960s. Books didn't write about it most until 2022.",
    view: "words",
    steps: [
      { text: "Wikipedia has the miniskirt on in London from 1960 to 1969. That's the shaded band.", params: { trends: "miniskirt", year: "1965" } },
      { text: "But British books mention it more every decade since, and peak in 2022. Writing about clothes lags wearing them, a lot.", params: { trends: "miniskirt", year: "2022" } },
      { text: "Shoulder pads are the exception: books peak in 1954, when the 1940s ones were still fresh. Compare them yourself.", params: { trends: "miniskirt,shoulder-pads", year: "1954" } },
    ],
  },
];

/** One story a day, the same for everyone in the UK that day. */
export function storyFor(ukDate: string) {
  const day = Math.floor(Date.parse(`${ukDate}T12:00:00Z`) / 86_400_000);
  return STORIES[((day % STORIES.length) + STORIES.length) % STORIES.length];
}
