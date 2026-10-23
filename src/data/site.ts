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

// Stripe Payment Links: `link` is live, `testLink` is the sandbox. Empty links skip checkout and go to the thanks page.
export const sponsorAmounts = [
  { value: "40", label: "40p", link: "https://buy.stripe.com/bJe6oH7CCdCd4K74Vd7Zu00", testLink: "https://buy.stripe.com/test_14AbJ09Aygvl4cvbmLdfG00" },
  { value: "400", label: "£4", link: "https://buy.stripe.com/dRm28r7CCbu5a4revN7Zu01", testLink: "https://buy.stripe.com/test_5kQcN49Ay4MDgZh9eDdfG01" },
  { value: "4000", label: "£40", link: "https://buy.stripe.com/3cIeVdaOOcy96Sfafx7Zu02", testLink: "https://buy.stripe.com/test_dRm14m1424MDeR9aiHdfG02" },
  { value: "40000", label: "£400", link: "https://buy.stripe.com/dRm6oHaOOgOp90n87p7Zu03", testLink: "https://buy.stripe.com/test_eVqeVc8wu6UL6kD62rdfG03" },
  { value: "400000", label: "£4,000", link: "https://buy.stripe.com/9B63cv8GGaq1gsPevN7Zu04", testLink: "https://buy.stripe.com/test_28E00i4gecf5fVd2QfdfG04" },
  { value: "4000000", label: "£40,000", link: "https://buy.stripe.com/3cIcN56yy0PrgsP2N57Zu05", testLink: "https://buy.stripe.com/test_6oU00ifYWend6kDbmLdfG05" },
  { value: "40000000", label: "£400,000", link: "https://buy.stripe.com/14A6oH2iicy9b8vafx7Zu06", testLink: "https://buy.stripe.com/test_eVqcN41422EvcJ19eDdfG06" },
  { value: "400000000", label: "£4,000,000", link: "https://buy.stripe.com/00wcN5aOOdCd2BZ5Zh7Zu07", testLink: "https://buy.stripe.com/test_fZu28q5kicf5gZhduTdfG07" },
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
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(amount);

export const initials = (name: string) =>
  name.replace(/^Dr\.?\s+/, "").split(/\s+/).map((part) => part[0]).join("").slice(0, 2);
