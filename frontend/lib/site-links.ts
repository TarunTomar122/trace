// Shared outbound links for the marketing site.

// Set NEXT_PUBLIC_GITHUB_REPO_URL once the repo is public; until then every
// "source on GitHub" link stays hidden instead of pointing at a 404.
export const GITHUB_REPO_URL = process.env.NEXT_PUBLIC_GITHUB_REPO_URL || '';

// Public contact address shown on legal/contact pages. Override per deployment.
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'tomartarun2001@gmail.com';

// Tips that keep the free version running.
export const BUY_ME_A_COFFEE_URL = process.env.NEXT_PUBLIC_BUY_ME_A_COFFEE_URL || 'https://buymeacoffee.com/taratdev';
