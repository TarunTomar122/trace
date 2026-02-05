# Trace - Claudia Mobile App

React Native mobile application for Claudia's content discovery platform. Built with Expo for iOS and Android.

## 🎯 Features

- **Native Feed Experience**: Optimized for mobile reading
- **Offline Support**: Cache feed items for offline access
- **Push Notifications**: Daily feed reminders
- **Fast Navigation**: Tab-based navigation
- **Firebase Auth**: Email, Google, Apple Sign-In
- **Real-time Sync**: Firebase Firestore integration

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Expo CLI
- iOS Simulator (Mac only) or Android Emulator
- Firebase project with iOS/Android apps configured

### 1. Install Dependencies

```bash
cd trace
npm install
```

### 2. Environment Setup

Create `.env`:

```bash
# Firebase Config
EXPO_PUBLIC_FIREBASE_API_KEY=AIza...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:ios:abc123
```

### 3. iOS Setup (Mac only)

```bash
cd ios
pod install
cd ..
```

### 4. Run Development

```bash
# Start Expo
npx expo start

# Run on iOS
npx expo run:ios

# Run on Android
npx expo run:android
```

## 📁 Project Structure

```
trace/
├── app/                          # Expo Router
│   ├── (tabs)/                   # Tab navigation
│   │   ├── index.tsx            # Feed tab
│   │   ├── bookmarks.tsx        # Bookmarks tab
│   │   └── profile.tsx          # Profile tab
│   │
│   ├── (auth)/                   # Auth screens
│   │   ├── sign-in.tsx
│   │   └── sign-up.tsx
│   │
│   ├── onboarding.tsx           # Onboarding flow
│   ├── modal.tsx                # Item detail modal
│   └── _layout.tsx              # Root layout
│
├── components/                   # Shared components
│   ├── FeedCard.tsx             # Feed item card
│   └── ui/                      # UI components
│
├── contexts/                     # React contexts
│   └── AuthContext.tsx          # Firebase auth
│
├── lib/                         # Utilities
│   ├── firebase.ts              # Firebase config
│   └── firestore.ts             # Firestore helpers
│
├── constants/                    # App constants
│   └── theme.ts                 # Theme config
│
├── assets/                      # Images, fonts
├── ios/                         # iOS native code
├── android/                     # Android native code
├── app.json                     # Expo config
└── package.json                 # Dependencies
```

## 📱 Key Features

### Tab Navigation

- **Feed**: Daily personalized content (25 or 10 items)
- **Bookmarks**: Saved items for later
- **Profile**: Settings, preferences, account

### Feed Card Component

```typescript
<FeedCard
  item={item}
  onPress={() => openItem(item)}
  onBookmark={() => toggleBookmark(item.id)}
  isBookmarked={bookmarkedIds.includes(item.id)}
/>
```

### Firebase Integration

```typescript
// contexts/AuthContext.tsx
const { user } = useAuth()

// Fetch feed
const feedRef = doc(db, `user_feeds/${user.uid}/daily/${today}`)
const feedSnap = await getDoc(feedRef)
const items = feedSnap.data()?.items || []
```

## 🎨 Design System

### Theme (`constants/theme.ts`)

```typescript
export const Colors = {
  light: {
    primary: '#7C3AED',
    background: '#FFFFFF',
    text: '#000000',
    secondary: '#6B7280',
  },
  dark: {
    primary: '#A78BFA',
    background: '#000000',
    text: '#FFFFFF',
    secondary: '#9CA3AF',
  },
}
```

### Components

- Themed text: `<ThemedText>` 
- Themed view: `<ThemedView>`
- Custom cards, buttons, inputs

## 📦 Dependencies

```json
{
  "dependencies": {
    "expo": "~52.0.0",
    "expo-router": "~4.0.0",
    "react-native": "0.76.5",
    "firebase": "^11.1.0",
    "@react-native-firebase/app": "^21.7.2",
    "@react-native-firebase/auth": "^21.7.2"
  }
}
```

## 🚀 Build & Deploy

### iOS (TestFlight)

```bash
# Build
eas build --platform ios

# Submit to TestFlight
eas submit --platform ios
```

### Android (Google Play)

```bash
# Build
eas build --platform android

# Submit to Play Console
eas submit --platform android
```

## 🐛 Troubleshooting

### "Metro bundler not starting"
```bash
npx expo start --clear
```

### "Firebase not connecting"
- Check `GoogleService-Info.plist` (iOS) is in `/ios`
- Check `google-services.json` (Android) is in `/android/app`
- Verify bundle ID matches Firebase console

### "Build failing"
```bash
# Clear cache
rm -rf node_modules
npm install
cd ios && pod install
```

## 📞 Support

For mobile app issues:
1. Check Expo dev tools console
2. Review native logs (Xcode/Android Studio)
3. Verify Firebase configuration
4. Test on physical device (not just simulator)

---

**Tech Stack**: React Native, Expo, TypeScript, Firebase
**Platforms**: iOS 13+, Android 8+
**Last Updated**: February 2026
