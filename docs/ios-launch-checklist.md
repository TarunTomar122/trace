# iOS Launch Checklist

Last updated: 2026-03-15

## Done

- Apple bundle ID created: `online.yourtrace.app`
- Expo / EAS project linked
  - [trace/app.json](/Users/ttomar/Documents/personal/claudia/trace/app.json) now has an EAS project ID
- RevenueCat is already integrated in the app
  - entitlement expected by app: `trace Premium`
- App Store Connect API / RevenueCat connection configured
- iOS app added inside the existing RevenueCat project
- RevenueCat iOS public SDK key added to app code
  - file: [trace/contexts/RevenueCatContext.tsx](/Users/ttomar/Documents/personal/claudia/trace/contexts/RevenueCatContext.tsx)
  - iOS key: `appl_wxLpHRKnErnnHufdxErbGxwmavE`
- App Store Connect subscription trial duration chosen
  - currently set to `3 days`
- New `For You` backend replaced with the daily brief flow

## Needs To Be Done

### App Store Connect

- Create the actual App Store Connect app record for `online.yourtrace.app` if not already done
- Finish all iOS subscription products in App Store Connect
  - subscription group: `Trace Premium`
  - products:
    - `trace_weekly`
    - `trace_monthly`
    - `trace_yearly`
- Set pricing for all three subscription products
- Resolve `Missing Metadata` status on Apple subscription products
  - likely check:
    - localization display name + description
    - pricing saved correctly
    - App Store Connect propagation delay
- Confirm the intro offer is set correctly on each product if trial is kept
  - currently intended trial: `3 days`
- Create at least one Sandbox Tester account

### RevenueCat

- Add the iOS app inside the existing RevenueCat project
  - bundle ID: `online.yourtrace.app`
- Verify the Apple products are fully attached to the existing entitlement
  - `trace Premium`
- Import / sync the App Store subscription products into RevenueCat
- Attach Apple products to the existing entitlement
  - `trace Premium`
- Add Apple products to the current offering packages
  - weekly -> `trace_weekly`
  - monthly -> `trace_monthly`
  - annual -> `trace_yearly`

### App Code

- Update iOS paywall copy to match the real Apple trial length
  - file: [trace/app/paywall.tsx](/Users/ttomar/Documents/personal/claudia/trace/app/paywall.tsx)
  - change `TRIAL_DAYS` from `4` to `3`
- Add iOS `buildNumber` to app config
  - file: [trace/app.json](/Users/ttomar/Documents/personal/claudia/trace/app.json)
- Replace placeholder / inconsistent App Store URLs
  - [trace/app/_layout.tsx](/Users/ttomar/Documents/personal/claudia/trace/app/_layout.tsx)
  - [trace/app/(tabs)/index.tsx](/Users/ttomar/Documents/personal/claudia/trace/app/(tabs)/index.tsx)
- Decide whether to add Sign in with Apple before review

### Build / Release

- Create at least one iOS sandbox tester in App Store Connect
- Run first production iOS build
  - `npx eas-cli@latest build -p ios --profile production`
- Install and test through TestFlight
- Verify on real iPhone:
  - sign in
  - onboarding
  - feed load
  - `Your daily brief`
  - paywall
  - purchase
  - restore purchases
  - push notifications
  - sharing
- Fill App Store listing metadata
  - description
  - subtitle
  - keywords
  - screenshots
  - privacy policy URL
  - support URL
  - app privacy answers
- Submit for review

## Notes

- The app currently expects RevenueCat entitlement ID exactly as:
  - `trace Premium`
- The paywall currently expects package shapes:
  - weekly
  - monthly
  - yearly / annual
- If the Apple trial stays at `3 days`, app copy must match that everywhere.
