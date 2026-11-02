import type { Brand } from "./brands";

export const UK_TZ = "Europe/London";
export const START = "2026-11-02T10:00:00Z";
export const TOTAL_DAYS = 40;

const handle = "build40for40";

export const links = {
  twitch: `https://www.twitch.tv/${handle}`,
  twitchChannel: handle,
  email: "help@build40for40.com",
  socials: [
    { brand: "twitch", href: `https://www.twitch.tv/${handle}` },
    { brand: "youtube", href: `https://www.youtube.com/@${handle}` },
    { brand: "substack", href: `https://${handle}.substack.com/` },
    { brand: "x", href: "https://x.com/ben_bourdin", label: "Ben on X" },
    { brand: "linkedin", href: "https://www.linkedin.com/in/createsandbreaksthings/", label: "Samira on LinkedIn" },
    { brand: "instagram", href: `https://www.instagram.com/${handle}` },
    { brand: "tiktok", href: `https://www.tiktok.com/@${handle}` },
  ] satisfies { brand: Brand; href: string; label?: string }[],
};

export const involvement = [
  { value: "kind", label: "Help (e.g. office space, credits)", note: "help_note", prompt: "What help?" },
  { value: "guest", label: "Be a guest", note: "guest_note", prompt: "Why do you want to be a guest?" },
] as const;

// The disco ball in the pool opens this in the day box. The video goes in once it's recorded.
export const sponsorUs = {
  title: "40 for 40",
  tagline: "We’re making building fun again",
  pitch: "Sponsor us so Lawrence can feed his dog, Ben can keep spending tokens and Samira can get massages.",
  team: "Lawrence, Samira and Ben",
  share: "Share it, help us get real jobs",
  video: "",
  // A still from the stream, behind the "coming soon" note and as the video's poster once it's in.
  still: "/sponsor-us/still.webp",
};

export const companySponsors = [{ name: "Superthread", url: "https://superthread.com", logo: "/sponsors/superthread.svg", width: 320, height: 64 }];

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

