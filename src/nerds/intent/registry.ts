export interface IntentQuestion {
  instructions: string;
  criteria: { true: string; false: string };
}

export interface FallbackClues {
  text: string;
  trend: boolean;
  era: boolean;
}

export interface IntentComponent {
  id: string;
  label: string;
  available: boolean;
  // Each is one yes or no for Jev about `search`. The component's score is its best answer.
  questions: Record<string, IntentQuestion>;
  // Stands in for Jev when it's down or unset.
  fallback: (clues: FallbackClues) => boolean;
}

// At or above this, a component is shown (or, when it isn't built yet, counted as wanted). Between 0.3 and this the
// search didn't settle it, and the page shows nothing for it.
export const SHOW_THRESHOLD = 0.7;
// Jev's probability that the search is about a trend it only loosely matched by words.
export const TREND_THRESHOLD = 0.7;
export const MAX_QUERY = 120;
export const INTENT_ENDPOINT = "/api/nerds-of-fashion/intent";

const has = (pattern: RegExp) => (text: string) => pattern.test(text);
const asksWhere = has(/\b(where|country|countries|city|cities|place|places|world|map|globe|origin|origins|originated?|invented|london|paris|milan|new york|britain|british|england|america|american|france|french|italy|italian)\b/);
const asksWhen = has(/\b(when|what year|which year|how long|peak|peaked|heyday|timeline|history|in fashion|in style)\b/);
const asksFuture = has(/\b(coming back|come back|comeback|return|returning|revival|revived|again|next year|future|forecast|predict|prediction|will|2027|2028|2029)\b/);

export const components = [
  {
    id: "globe",
    label: "The globe",
    available: true,
    questions: {
      where: {
        instructions: "Does the person who typed `search` want to know where in the world a fashion trend started or was worn?",
        criteria: {
          true: "They ask which place, country or city a garment, look or subculture came from or was popular in.",
          false: "They ask something else about fashion, such as when it was worn or what it is, and no place is asked about.",
        },
      },
      wearing: {
        instructions: "Does the person who typed `search` want to know what people were wearing in a particular place or period?",
        criteria: {
          true: "They name a year, decade, era, country or city and ask what was in fashion there or then.",
          false: "They ask about one named garment or look, or they name no place and no period.",
        },
      },
    },
    fallback: ({ text, trend, era }) => asksWhere(text) || (era && !trend),
  },
  {
    id: "timeline",
    label: "The timeline",
    available: false,
    questions: {
      when: {
        instructions: "Does the person who typed `search` want to know when a named garment or look was in fashion?",
        criteria: {
          true: "They name a garment, look or subculture and ask about the years it was worn, how long it lasted or when it peaked.",
          false: "They name no garment or look, or they ask where it came from, what it is or whether it will return.",
        },
      },
    },
    fallback: ({ text, trend }) => trend && asksWhen(text),
  },
  {
    id: "forecast",
    label: "The forecast",
    available: false,
    questions: {
      comeback: {
        instructions: "Does the person who typed `search` want to know whether or when a garment or look will be in fashion again in the coming years?",
        criteria: {
          true: "They ask about the future: whether something is coming back, when it will return or what will be worn next.",
          false: "They ask only about the past or the present, such as when something was worn or where it started.",
        },
      },
    },
    fallback: ({ text }) => asksFuture(text),
  },
  {
    id: "trend-card",
    label: "The trend card",
    available: false,
    questions: {
      what: {
        instructions: "Does the person who typed `search` want to know what a named garment or look is?",
        criteria: {
          true: "They name a garment, look or subculture and ask what it is, what it looks like or who wore it, or they type only its name.",
          false: "They name no garment or look, or they ask only where, when or whether it will return.",
        },
      },
    },
    fallback: ({ text, trend }) => trend && !asksWhere(text) && !asksWhen(text) && !asksFuture(text),
  },
] as const satisfies readonly IntentComponent[];

export type ComponentId = (typeof components)[number]["id"];

export interface ComponentScore {
  id: ComponentId;
  score: number;
  available: boolean;
}

export interface IntentResult {
  q: string;
  components: ComponentScore[];
  trend: { id: string; name: string; score: number } | null;
  year: number | null;
  decade: number | null;
  ms: number;
  fallback: boolean;
}
