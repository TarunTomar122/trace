# Mobile follow-up: trending taxonomy migration

The backend and web have moved trending interests to this canonical set:

- `ai`
- `tech`
- `startups`
- `markets`
- `engineering`
- `product-design`
- `marketing`
- `fintech`

## What Claude needs to update in mobile

### 1. Replace the onboarding interest list
Update:
- `/Users/ttomar/Documents/personal/claudia/trace/lib/firestore.ts`

Current mobile onboarding still exposes old IDs like:
- `technology`
- `experience`
- `business-market`
- `leadership`
- `productivity`
- `health`
- `web3`
- `climate`

It should switch to the new 8-item list above.

### 2. Update mobile feed labels and aliases
Update:
- `/Users/ttomar/Documents/personal/claudia/trace/app/(tabs)/index.tsx`

Specifically:
- `INTEREST_LABELS`
- `INTEREST_ALIASES`
- any `normalizeInterestId()` logic

New labels should be:
- `ai` -> `AI`
- `tech` -> `Tech`
- `startups` -> `Startups`
- `markets` -> `Markets`
- `engineering` -> `Engineering`
- `product-design` -> `Product & Design`
- `marketing` -> `Marketing`
- `fintech` -> `Fintech`

Legacy values should still normalize temporarily:
- `technology` -> `tech`
- `business-market` -> `markets`
- `experience` / `design` -> `product-design`
- `leadership` -> `markets`
- `productivity` -> `tech`
- `health` -> `tech`
- `climate` -> `tech`
- `web3` -> `fintech`

### 3. Update preference screens
Update:
- `/Users/ttomar/Documents/personal/claudia/trace/app/preferences/interests.tsx`
- `/Users/ttomar/Documents/personal/claudia/trace/app/preferences/index.tsx`

These screens rely on `ONBOARDING_INTERESTS` labels and should show the new taxonomy cleanly.

### 4. Update mobile onboarding copy
Update:
- `/Users/ttomar/Documents/personal/claudia/trace/app/onboarding.tsx`
- `/Users/ttomar/Documents/personal/claudia/trace/app/(auth)/welcome.tsx`

Make the product story trending-first:
- pick the beats you care about
- get grouped topic briefings
- remove stale `For You` framing where it still exists

### 5. Check any remaining old-interest UI text
Search mobile for:
- `technology`
- `business-market`
- `experience`
- `leadership`
- `productivity`
- `health`
- `web3`
- `climate`

and replace or normalize where they are still exposed in user-facing UI.

## Expected temporary state

Backend now emits the new trending taxonomy.
If mobile is not updated, the app should still mostly render, but:
- pills may be wrong
- labels may be raw IDs
- filters may behave inconsistently

So this mobile update is mainly a UI/polish compatibility pass after the backend cut.
