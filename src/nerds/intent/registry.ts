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
const asksFuture = has(/\b(coming back|come back|comeback|return|returning|again|next year|future|forecast|predict|prediction|will|2027|2028|2029)\b/);
const asksRevival = has(/\b(revival|revived|came back|come back|comeback|retro|vintage|throwback|inspired by)\b/);
const asksColour = has(/\b(colou?rs?|pantone|shade|shades|hue|hues|palette)\b/);
const asksShape = has(/\b(silhouettes?|shape|shapes|hemlines?|hems?|waists?|waistline|shoulders?|skirt length)\b/);
const asksMuseum = has(/\b(museums?|v&a|victoria and albert|the met|archive|archives|collection|collections|designers?|couture)\b/);
const asksWords = has(/\b(books?|written|wrote|word|words|mentions?|mentioned|ngram|called|jumper|sweater)\b/);
const asksKinds = has(/\b(hair|make-?up|shoes|footwear|accessories|subcultures?|categories|kinds?|types?)\b/);

// One entry per view in src/nerds/views, by its id, plus the ones people ask for that aren't built yet.
export const components = [
  {
    id: "globe",
    label: "the globe",
    available: true,
    questions: {
      where: {
        instructions: "Does the person who typed `search` want to know where in the world a fashion trend started or was worn?",
        criteria: {
          true: "They ask which place, country or city a garment, look or subculture came from or was popular in.",
          false: "They ask something else about fashion, such as when it was worn or what it is, and no place is asked about.",
        },
      },
      place: {
        instructions: "Does the person who typed `search` want to know what people in a named country or city were wearing?",
        criteria: {
          true: "They name a country or city and ask what was in fashion there.",
          false: "They name no country or city, such as when they only name a year, a decade or a garment.",
        },
      },
    },
    fallback: ({ text }) => asksWhere(text),
  },
  {
    id: "board",
    label: "the Big Board",
    available: true,
    questions: {
      when: {
        instructions: "Does the person who typed `search` want to know when a named garment or look was in fashion?",
        criteria: {
          true: "They name a garment, look or subculture and ask about the years it was worn, how long it lasted or when it peaked.",
          false: "They name no garment or look, or they ask where it came from, what it is or whether it will return.",
        },
      },
    },
    fallback: ({ text, trend }) => trend && asksWhen(text) && !asksFuture(text),
  },
  {
    id: "dancefloor",
    label: "the Dance Floor",
    available: true,
    questions: {
      era: {
        instructions: "Does the person who typed `search` want to know which fashion trends were popular in a particular year or decade?",
        criteria: {
          true: "They name a year, a decade or an era and ask what was in fashion then, without naming one garment or one place.",
          false: "They name no year, decade or era, or they ask about one named garment or one named place.",
        },
      },
    },
    fallback: ({ text, trend, era }) => era && !trend && !asksWhere(text) && !asksColour(text) && !asksShape(text) && !asksMuseum(text),
  },
  {
    id: "stream",
    label: "the River of Trends",
    available: true,
    questions: {
      kinds: {
        instructions: "Does the person who typed `search` want to compare how busy different kinds of fashion were over the years?",
        criteria: {
          true: "They ask how clothes, subcultures, shoes and accessories, or hair and make-up rose and fell against each other over time.",
          false: "They ask about one named garment or look, or about a single year.",
        },
      },
    },
    fallback: ({ text, trend }) => !trend && asksKinds(text) && asksWhen(text),
  },
  {
    id: "strings",
    label: "String Theory",
    available: true,
    questions: {
      revival: {
        instructions: "Does the person who typed `search` want to know which past fashion a look was a revival of, or which looks have come back before?",
        criteria: {
          true: "They ask about a comeback that has already happened: what was revived, when, or which earlier era a look copied.",
          false: "They ask about the future, or about a look's first time in fashion.",
        },
      },
    },
    fallback: ({ text }) => asksRevival(text) && !asksFuture(text),
  },
  {
    id: "gaps",
    label: "the comeback clock",
    available: true,
    questions: {
      comeback: {
        instructions: "Does the person who typed `search` want to know whether or when a garment or look will be in fashion again in the coming years?",
        criteria: {
          true: "They ask about the future: whether something is coming back, when it will return or what will be worn next.",
          false: "They ask only about the past or the present, such as when something was worn or where it started.",
        },
      },
      wait: {
        instructions: "Does the person who typed `search` want to know how many years fashion trends take to come back?",
        criteria: {
          true: "They ask how long a look stays away before it returns, or whether fashion runs on a cycle of a fixed number of years.",
          false: "They ask about one moment in time, or about something other than the wait between comebacks.",
        },
      },
    },
    fallback: ({ text }) => asksFuture(text),
  },
  {
    id: "colour",
    label: "a century in colour",
    available: true,
    questions: {
      colour: {
        instructions: "Does the person who typed `search` want to know which colours were in fashion?",
        criteria: {
          true: "They ask about a colour, or about the colours of a year, a decade or an era.",
          false: "They ask about garments, shapes, places or dates and mention no colour.",
        },
      },
    },
    fallback: ({ text }) => asksColour(text),
  },
  {
    id: "silhouette",
    label: "the silhouette",
    available: true,
    questions: {
      shape: {
        instructions: "Does the person who typed `search` want to know how the shape of women's clothes changed?",
        criteria: {
          true: "They ask about hemlines, waistlines, shoulders or the overall outline of an outfit in a year or across the years.",
          false: "They ask about a garment, a colour or a subculture without asking about its shape or length.",
        },
      },
    },
    fallback: ({ text }) => asksShape(text),
  },
  {
    id: "museum",
    label: "the museum wardrobes",
    available: true,
    questions: {
      kept: {
        instructions: "Does the person who typed `search` want to see real garments that museums have kept?",
        criteria: {
          true: "They ask about museum collections, surviving pieces, designers' work in an archive, or what a real garment from a period looked like.",
          false: "They ask about a trend in general and mention no museum, archive, designer or surviving piece.",
        },
      },
    },
    fallback: ({ text }) => asksMuseum(text),
  },
  {
    id: "words",
    label: "the books chart",
    available: true,
    questions: {
      written: {
        instructions: "Does the person who typed `search` want to know how much a garment or look was written about?",
        criteria: {
          true: "They ask how often it appeared in books, when the word for it took off, or how British and American writers named it.",
          false: "They ask when or where it was worn, and nothing about writing, books or words.",
        },
      },
    },
    fallback: ({ text }) => asksWords(text),
  },
  {
    id: "arcs",
    label: "Everything Comes Back",
    available: true,
    questions: {
      comeback: {
        instructions: "Does the person who typed `search` want to know which looks have come back, or how long comebacks take?",
        criteria: {
          true: "They ask about comebacks, revivals or the gap before a look returns, past or future.",
          false: "They ask about something other than looks returning.",
        },
      },
    },
    // Keywords already send comebacks to the gaps view, so only Jev picks this one.
    fallback: () => false,
  },
  {
    id: "ebb",
    label: "The Ebb and Flow",
    available: true,
    questions: {
      overview: {
        instructions: "Does the person who typed `search` want an overview of which trends rose and fell across the century?",
        criteria: {
          true: "They ask what was in over time, which trends defined each decade, or how fashion changed overall.",
          false: "They ask about one specific trend's detail, place, colour or shape.",
        },
      },
    },
    fallback: () => false,
  },
  {
    id: "hear",
    label: "Hear the Century",
    available: true,
    questions: {
      sound: {
        instructions: "Does the person who typed `search` want to hear fashion, or ask about sound or music?",
        criteria: {
          true: "They mention sound, music, listening, hearing or playing something.",
          false: "They mention nothing about sound or music.",
        },
      },
    },
    fallback: ({ text }) => /\b(sound|sounds|music|hear|listen|play|audio|song)\b/.test(text),
  },
  {
    id: "trend-card",
    label: "a trend card",
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
    fallback: ({ text, trend }) => trend && ![asksWhere, asksWhen, asksFuture, asksRevival, asksColour, asksShape, asksMuseum, asksWords].some((asks) => asks(text)),
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
