# Frontend - Claudia Web Application

Next.js 14 web application for Claudia's content discovery platform. Features onboarding, personalized feeds, profile management, and newsletter subscriptions.

## 🎯 Features

- **Smart Onboarding**: 3-step wizard with live feed preview
- **Personalized Feed**: 25 items/day (subscribed) or 10 items/day (free)
- **Real-time Updates**: Firebase sync for feed items
- **Responsive Design**: Mobile-first, tablet and desktop optimized
- **Analytics**: PostHog integration for user behavior tracking
- **Auth**: Firebase Authentication (Email, Google, Apple)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Firebase project with Firestore
- PostHog account (optional, for analytics)

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Environment Setup

Copy the template:

```bash
cp env.template .env.local
```

Configure `.env.local`:

```bash
# Firebase Config (from Firebase Console > Project Settings)
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# PostHog Analytics (optional)
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Environment
NEXT_PUBLIC_ENV=development
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
frontend/
├── app/                        # Next.js App Router
│   ├── api/                    # API routes
│   │   ├── auth/              # Auth endpoints
│   │   ├── feed/              # Feed data endpoints
│   │   └── profile/           # Profile management
│   │
│   ├── onboarding/            # Onboarding flow
│   │   └── page.tsx           # Main onboarding page (3 steps)
│   │
│   ├── feed/                  # Main feed page
│   │   └── page.tsx           # Feed with filters, bookmarks
│   │
│   ├── profile/               # User profile
│   │   └── page.tsx           # Settings, preferences
│   │
│   ├── bookmarks/             # Saved items
│   ├── trending/              # Trending content
│   ├── research/              # Research tools
│   ├── dev/                   # Dev tools (admin only)
│   │
│   ├── layout.tsx             # Root layout
│   ├── page.tsx               # Landing page
│   └── globals.css            # Global styles
│
├── components/                # Shared components
│   ├── Header.tsx             # App header with nav
│   ├── MainNav.tsx            # Main navigation
│   ├── PublicHeader.tsx       # Public site header
│   ├── TraceInsightCard.tsx   # Feed item card
│   └── SubscriptionManager.tsx # Subscription UI
│
├── contexts/                  # React contexts
│   └── AuthContext.tsx        # Firebase auth context
│
├── lib/                       # Utilities and config
│   ├── firebase.ts            # Firebase client config
│   ├── firebase-admin.ts      # Admin SDK (server-side)
│   ├── firestore.ts           # Firestore helpers
│   ├── posthog.tsx            # PostHog provider
│   ├── traceInsights.ts       # Feed data fetching
│   └── alpha.ts               # Alpha access utilities
│
├── public/                    # Static assets
├── next.config.ts             # Next.js configuration
├── tailwind.config.ts         # Tailwind CSS config
├── tsconfig.json              # TypeScript config
└── package.json               # Dependencies
```

## 🎨 Key Pages & Components

### Landing Page (`app/page.tsx`)

**Route**: `/`

**Features:**
- Hero section with product demo
- Feature highlights
- Waitlist signup (pre-launch)
- Responsive design

### Onboarding (`app/onboarding/page.tsx`)

**Route**: `/onboarding`

**3-Step Flow:**

1. **Select Interests** (4 required)
   - 14 canonical interests to choose from
   - Visual cards with icons
   - Signal strength indicator
   - Callout: "90% of users feel their feed is more useful after selecting all 4"

2. **Choose Subtopics** (optional, 2 per interest)
   - Personalized prompts: "You like Technology... what about it interests you the most?"
   - Predefined subtopics per interest
   - Live feed preview updates with visual callouts (✦ symbol)
   - Option to skip

3. **Add Skills** (optional)
   - Skills for content personalization
   - Examples: "python", "machine learning", "content creation"
   - Feed preview shows skill-specific content

**Features:**
- Real-time feed preview (right sidebar, desktop only)
- Dynamic updates as user makes selections
- Signal strength bar (progress indicator)
- Button states: "Continue" → "Build my signal"
- Auto-saves to Firebase on completion

**State Management:**
```typescript
const [step, setStep] = useState(1)
const [selectedInterests, setSelectedInterests] = useState<string[]>([])
const [selectedFocus, setSelectedFocus] = useState<Record<string, string[]>>({})
const [selectedSkills, setSelectedSkills] = useState<string[]>([])
```

### Feed Page (`app/feed/page.tsx`)

**Route**: `/feed`

**Features:**
- Daily feed items (25 for subscribed, 10 for free)
- Filters: All, Unread, Bookmarked
- Item cards with:
  - Title, summary, source
  - "Why relevant" badge
  - Bookmark button
  - External link
- Auto-marks as read on click
- Tracks `seen_urls` to avoid repeats
- Sticky banner (hidden on mobile): Product updates

**Data Flow:**
```typescript
const fetchFeedItems = async (userId: string, date: string) => {
  const feedRef = db
    .collection('user_feeds')
    .doc(userId)
    .collection('daily')
    .doc(date)
  
  const doc = await feedRef.get()
  return doc.data()?.items || []
}
```

### Profile Page (`app/profile/page.tsx`)

**Route**: `/profile`

**Sections:**
- Account settings (email, name)
- Interests & subtopics (edit selections)
- Skills management
- Newsletter preferences (opt-in/out)
- Subscription status & management
- Sign out button

## 🔥 Firebase Integration

### Client-Side (`lib/firebase.ts`)

```typescript
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
```

### Auth Context (`contexts/AuthContext.tsx`)

```typescript
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Firebase auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
    })
    return unsubscribe
  }, [])
  
  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
```

### Data Fetching Pattern

```typescript
// Real-time subscription
useEffect(() => {
  if (!user) return
  
  const feedRef = db
    .collection('user_feeds')
    .doc(user.uid)
    .collection('daily')
    .doc(todayDate)
  
  const unsubscribe = onSnapshot(feedRef, (doc) => {
    const items = doc.data()?.items || []
    setFeedItems(items)
  })
  
  return () => unsubscribe()
}, [user, todayDate])
```

## 📊 Analytics (PostHog)

### Setup (`lib/posthog.tsx`)

```typescript
'use client'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'

if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  })
}
```

### Event Tracking

```typescript
import { usePostHog } from 'posthog-js/react'

const posthog = usePostHog()

// Track events
posthog.capture('onboarding_completed', {
  interests_count: selectedInterests.length,
  skills_count: selectedSkills.length,
  method: 'simple',
})

posthog.capture('feed_item_clicked', {
  item_id: item.id,
  item_type: item.type,
  interest: item.tags[0],
})
```

## 🎨 Styling

### Tailwind CSS

**Config** (`tailwind.config.ts`):
```typescript
{
  theme: {
    extend: {
      colors: {
        foreground: 'var(--foreground)',
        background: 'var(--background)',
        secondary: 'var(--secondary)',
      }
    }
  }
}
```

**Utility Classes**:
```tsx
// Cards
<div className="rounded-2xl border border-gray-100 bg-white/60 p-5">

// Buttons
<button className="rounded-lg bg-violet-600 px-6 py-3 text-white shadow-sm">

// Text
<div className="text-sm font-medium leading-snug text-foreground/90">
```

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Production
vercel --prod
```

**vercel.json**:
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api/:path*"
    }
  ]
}
```

### Environment Variables (Vercel)

Add in Vercel Dashboard > Project Settings > Environment Variables:
- `NEXT_PUBLIC_FIREBASE_*` (all Firebase config)
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `NEXT_PUBLIC_ENV=production`

### Build Command

```bash
npm run build
```

### Output

```
.next/           # Build output
out/             # Static export (if using)
```

## 🧪 Testing

### Development Testing

```bash
# Run dev server
npm run dev

# Test specific routes
open http://localhost:3000/onboarding
open http://localhost:3000/feed
open http://localhost:3000/profile
```

### Production Build Testing

```bash
# Build
npm run build

# Start production server
npm start
```

## 🐛 Troubleshooting

### "Firebase not initialized"
- Check `.env.local` has all `NEXT_PUBLIC_FIREBASE_*` vars
- Restart dev server after .env changes

### "Auth not working"
- Enable Auth providers in Firebase Console
- Check domain allowlist includes `localhost` and your domain
- Verify Firebase rules allow read/write

### "PostHog events not tracking"
- Check `NEXT_PUBLIC_POSTHOG_KEY` is set
- Verify PostHog instance is running
- Check browser console for errors

### "Hydration errors"
- Use `'use client'` directive for client components
- Avoid conditional rendering that differs server/client
- Use `useEffect` for browser-only code

## 📦 Key Dependencies

```json
{
  "dependencies": {
    "next": "16.1.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "firebase": "^11.1.0",
    "firebase-admin": "^13.0.2",
    "posthog-js": "^1.198.1",
    "tailwindcss": "^3.4.1",
    "typescript": "^5"
  }
}
```

## 🔒 Security

### Firebase Rules

**Firestore** (`firestore.rules`):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User profiles
    match /user_profiles/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // User feeds
    match /user_feeds/{userId}/daily/{date} {
      allow read: if request.auth != null && request.auth.uid == userId;
    }
    
    // Topics (public read for feed generation)
    match /topics/{topic} {
      allow read: if request.auth != null;
    }
  }
}
```

### API Routes

Use Firebase Admin SDK for server-side operations:
```typescript
// app/api/profile/route.ts
import { adminAuth } from '@/lib/firebase-admin'

export async function GET(req: Request) {
  const token = req.headers.get('authorization')?.split('Bearer ')[1]
  
  if (!token) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  const decodedToken = await adminAuth.verifyIdToken(token)
  // ... proceed with authenticated request
}
```

## 🎯 Best Practices

1. **Use Server Components** where possible for better performance
2. **Client Components** only when needed (interactivity, hooks)
3. **Optimize Images** with Next.js Image component
4. **Code Splitting** via dynamic imports
5. **Error Boundaries** for graceful error handling
6. **Loading States** for better UX
7. **TypeScript** for type safety
8. **ESLint** for code quality

## 📞 Support

For frontend issues:
1. Check browser console for errors
2. Verify Firebase connection in Network tab
3. Test in incognito (rule out extensions)
4. Check Vercel deployment logs

---

**Tech Stack**: Next.js 14 (App Router), React 19, TypeScript, Tailwind CSS, Firebase, PostHog
**Last Updated**: February 2026
