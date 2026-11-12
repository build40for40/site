import type { Planned, Tab, View } from "./view";

const modules = import.meta.glob<{ default: View }>("./views/*.ts", { eager: true });

export const VIEWS: View[] = Object.values(modules)
  .map((module) => module.default)
  .filter(Boolean)
  .sort((a, b) => (a.order ?? 50) - (b.order ?? 50) || a.title.localeCompare(b.title));

export const viewById = (id: string) => VIEWS.find((view) => view.id === id);
export const viewsIn = (tab: Tab) => VIEWS.filter((view) => view.tab === tab);

// Where this goes next. Each is a real question the data can answer.
export const PLANNED: Planned[] = [
  { id: "hemline-index", tab: "shapes", title: "The hemline index", blurb: "Skirt length against the FTSE. Economists swear it's real" },
  { id: "waist-wander", tab: "shapes", title: "Where's the waist?", blurb: "It's been under the bust, on the hips and nowhere at all" },
  { id: "shoulder-span", tab: "shapes", title: "Shoulder span", blurb: "From slope to linebacker and back" },
  { id: "you-vs-mum", tab: "shapes", title: "You vs your mum", blurb: "Two birth years, two silhouettes, one argument" },
  { id: "half-life", tab: "trends", title: "Trend half-life", blurb: "How long a look lasts, and whether that's getting shorter" },
  { id: "family-tree", tab: "trends", title: "Family tree", blurb: "Mods begat skinheads begat Britpop" },
  { id: "periodic-table", tab: "trends", title: "Periodic table of trends", blurb: "Every element of style, by category and decade" },
  { id: "trading-cards", tab: "trends", title: "Trend trading cards", blurb: "Stats on the back, collect the set" },
  { id: "hype-cycle", tab: "trends", title: "The hype cycle", blurb: "Every trend's ride from cool to cringe to classic" },
  { id: "revival-pairs", tab: "comebacks", title: "Then and now", blurb: "The original and its revival, side by side" },
  { id: "pantone-wall", tab: "colour", title: "Pantone wall", blurb: "Every Colour of the Year, and who actually wore it" },
  { id: "colour-moods", tab: "colour", title: "Colour moods", blurb: "Do bright decades follow grim ones?" },
  { id: "speed-of-cool", tab: "world", title: "Speed of cool", blurb: "Trends travel faster every decade. By how much?" },
  { id: "city-rivalry", tab: "world", title: "London vs Paris vs New York", blurb: "Who started more of it" },
  { id: "designer-map", tab: "museums", title: "Designers in the archive", blurb: "Whose clothes the museums couldn't stop collecting" },
  { id: "fabric-shift", tab: "museums", title: "Silk to polyester", blurb: "What a century of clothes was made of" },
  { id: "catwalk-tags", tab: "museums", title: "Catwalk tags", blurb: "What runway cameras saw, look by look since 1988" },
  { id: "word-births", tab: "words", title: "First words", blurb: "The year each fashion word first hit print" },
];
