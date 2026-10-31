export interface Category {
  key: string;
  label: string;
  // What the classifier is told the category covers.
  covers: string;
}

// Bump the version whenever a category is added, removed or reworded, so every problem gets sorted again.
export const CATEGORIES_VERSION = 2;

export const categories: Category[] = [
  { key: "work", label: "Work & productivity", covers: "jobs, meetings, notes, colleagues, freelancing, running a small business or selling your work, goals, routines and getting things done" },
  { key: "finance", label: "Finance", covers: "budgets, bills, spending, splitting costs, subscriptions, saving, investing, tax and deals" },
  { key: "admin", label: "Life admin", covers: "paperwork, renewals, reminders, accounts, receipts, warranties and digital clutter" },
  { key: "home", label: "Home", covers: "chores, flatmates, moving house, repairs, DIY, gardening, pets and bins" },
  { key: "food", label: "Food", covers: "cooking, recipes, meal plans, groceries, nutrition and eating out" },
  { key: "kids", label: "Parenting & kids", covers: "babies, children, parenting, school, screen time and family logistics" },
  { key: "health", label: "Health & fitness", covers: "exercise, sleep, medication, appointments and physical health" },
  { key: "mind", label: "Mental health", covers: "stress, anxiety, loneliness, mood, self-belief, wellbeing and how what we see online makes us feel" },
  { key: "learning", label: "Learning", covers: "studying, languages, new skills, history and curiosity about the world" },
  { key: "fun", label: "Entertainment", covers: "games, music, podcasts, TV, books, art and hobbies" },
  { key: "travel", label: "Getting around", covers: "commuting, public transport, travel, parking, cars and trips" },
  { key: "community", label: "Friends & community", covers: "friends, keeping in touch, events, gifts, group chats, neighbours, local projects and volunteering" },
];

// Not a question for the classifier: problems that fit none of the categories land here.
export const OTHER: Category = { key: "other", label: "Other", covers: "" };

export const categoryConfig = {
  // A problem is in every category scoring at least `fits`, up to `most` of them, best first.
  fits: 0.7,
  most: 3,
  // Below `fits`, a best score of at least `unsure` isn't settled either way and is worth a look by the team. Below that,
  // nothing fits.
  unsure: 0.3,
};

export const categoryLabel = (key: string) => [...categories, OTHER].find((c) => c.key === key)?.label ?? key;

// Undefined until the classifier or the team has sorted the problem.
export function categoriesOf(scores: Record<string, number> | null | undefined): string[] | undefined {
  if (!scores) return undefined;
  const fitting = Object.entries(scores)
    .filter(([key, score]) => score >= categoryConfig.fits && categories.some((c) => c.key === key))
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, categoryConfig.most)
    .map(([key]) => key);
  return fitting.length ? fitting : [OTHER.key];
}
