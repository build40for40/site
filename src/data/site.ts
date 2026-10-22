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

export type PayKind = "unlock" | "sponsor" | "presale";

export const payOptions: Record<PayKind, { label: string; blurb: string; amount: number; link: string }> = {
  unlock: { label: "Unlock", blurb: "First payment starts the day", amount: 10, link: "#" },
  sponsor: { label: "Sponsor", blurb: "Your company on the day page", amount: 250, link: "#" },
  presale: { label: "Presale", blurb: "Pay now, get the app it ships", amount: 15, link: "#" },
};

export const helpTypes = [
  { value: "office", label: "Office space" },
  { value: "tools", label: "AI tools and tokens" },
  { value: "guests", label: "Guest intros" },
  { value: "cto", label: "CTO for a day" },
  { value: "sponsor", label: "Sponsor a day" },
  { value: "other", label: "Something else" },
] as const;

export const involvement = [
  { value: "kind", label: "Help in Kind - Office space, AI credits, I can cater an IRL event!" },
  { value: "marketing", label: "Marketing - I’ll spread the word" },
  { value: "guest", label: "Be a guest" },
  { value: "sponsor", label: "Sponsor a Project" },
] as const;

// Each link is a Stripe Payment Link. Empty links skip checkout and go to the thanks page.
export const sponsorAmounts = [
  { value: "40", label: "40¢", link: "" },
  { value: "400", label: "$4", link: "" },
  { value: "4000", label: "$40", link: "" },
  { value: "40000", label: "$400", link: "" },
  { value: "400000", label: "$4,000", link: "" },
  { value: "4000000", label: "$40,000", link: "" },
  { value: "40000000", label: "$400,000", link: "" },
  { value: "400000000", label: "$4,000,000", link: "" },
] as const;

export const guests = [
  { name: "Judith Buttigieg", role: "Special guest", photo: "" },
  { name: "Nic Roope", role: "Special guest", photo: "" },
  { name: "Dr. Zeenith Ebrahim", role: "Special guest", photo: "" },
];

export const team = [
  { name: "Lawrence Kao", role: "Host and builder", photo: "" },
  { name: "Samira Sohail", role: "Host and builder", photo: "" },
  { name: "Ben Bourdin", role: "Host and builder", photo: "" },
];

export const money = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);

export const initials = (name: string) =>
  name.replace(/^Dr\.?\s+/, "").split(/\s+/).map((part) => part[0]).join("").slice(0, 2);
