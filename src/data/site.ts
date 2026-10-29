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
  { value: "kind", label: "Help in Kind - Office space, AI credits, I can cater an IRL event!" },
  { value: "marketing", label: "Marketing - I’ll spread the word" },
  { value: "guest", label: "Be a guest" },
  { value: "sponsor", label: "Sponsor a Project" },
] as const;

export const helpTypes = [
  { value: "office", label: "Office space" },
  { value: "tools", label: "AI tools and tokens" },
  { value: "guests", label: "Guest intros" },
  { value: "cto", label: "CTO for a day" },
  { value: "sponsor", label: "Sponsor a day" },
  { value: "other", label: "Something else" },
] as const;

export const money = (amount: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(amount);

