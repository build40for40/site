export const UK_TZ = "Europe/London";
export const START = "2026-11-02T09:00:00Z";
export const TOTAL_DAYS = 40;

export const links = {
  twitch: "https://www.twitch.tv/40for40",
  twitchChannel: "40for40",
  community: "https://discord.gg/40for40",
  email: "hello@40for40.app",
  socials: [
    { label: "LinkedIn", href: "https://www.linkedin.com/company/40for40" },
    { label: "X", href: "https://x.com/40for40app" },
    { label: "Instagram", href: "https://www.instagram.com/40for40app" },
    { label: "TikTok", href: "https://www.tiktok.com/@40for40app" },
  ],
};

export const involvement = [
  { value: "kind", label: "Help (e.g. office space, credits)", note: "help_note", prompt: "What help?" },
  { value: "guest", label: "Be a guest", note: "guest_note", prompt: "Why do you want to be a guest?" },
] as const;

export const backings = ["share", "sponsor"] as const;

export const SPONSOR_AMOUNTS = [4, 40, 104, 400, 4_000, 40_000, 400_000, 4_000_000];

export const helpTypes = [
  { value: "office", label: "Office space" },
  { value: "tools", label: "AI tools and tokens" },
  { value: "guests", label: "Guest intros" },
  { value: "cto", label: "CTO for a day" },
  { value: "sponsor", label: "Sponsor a day" },
  { value: "other", label: "Something else" },
] as const;

export const money = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);

