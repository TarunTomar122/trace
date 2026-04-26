# Push Notifications Implementation

This document covers the push notification setup for the Trace mobile app (iOS & Android).

---

## Overview

- **Library:** `expo-notifications`
- **Token Type:** Expo Push Token
- **Storage:** Firestore `user_profiles/{uid}`
- **Deep Linking:** Trending articles from `v3_trending_pool`

---

## Frontend Files

| File | Purpose |
|------|---------|
| `lib/notifications.ts` | Core notification functions (register, enable, disable, listeners) |
| `app/_layout.tsx` | Initializes notifications, handles notification taps |
| `contexts/AuthContext.tsx` | Auto-registers push token after user login |
| `app/profile.tsx` | Push notification toggle in settings |
| `lib/firestore.ts` | `getArticleById()` for deep link lookup |
| `app.json` | Expo notification config + iOS background modes |

---

## Firestore Schema

### User Profile Fields

```typescript
// user_profiles/{uid}
{
  pushNotificationsEnabled?: boolean;  // User preference
  pushToken?: string;                   // Expo push token
  pushTokenUpdatedAt?: string;          // ISO timestamp
}
```

### Article Lookup (for deep links)

```
v3_trending_pool/{doc_id}
```

- `doc_id` = `sha256(article_url)[:32]` (URL hash)

---

## How It Works

### 1. Initialization (app start)

```typescript
// app/_layout.tsx - RootLayoutNav
useEffect(() => {
  initializeNotifications();  // Sets up Android channel

  const subscription = addNotificationResponseListener(async (response) => {
    const { articleId } = response.notification.request.content.data;
    if (articleId) {
      const article = await getArticleById(articleId);
      if (article) {
        setCurrentArticle(article);
        router.push('/article');
      }
    }
  });

  return () => subscription.remove();
}, []);
```

### 2. Token Registration (after login)

```typescript
// contexts/AuthContext.tsx - loadProfile()
if (userProfile?.onboarded && userProfile?.pushNotificationsEnabled !== false) {
  enablePushNotifications(firebaseUser.uid);
}
```

### 3. User Toggle (profile screen)

- Toggle calls `enablePushNotifications()` or `disablePushNotifications()`
- Disabling clears the token from Firestore (so backend won't send)

---

## Backend Requirements

### Notification Payload Format

```python
import hashlib
import requests

def _url_hash(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:32]

def send_push_notification(push_token: str, article: dict):
    """Send a push notification for a trending article."""

    response = requests.post(
        "https://exp.host/--/api/v2/push/send",
        json={
            "to": push_token,
            "title": article["title"],
            "body": article.get("summary", {}).get("short_article", {}).get("subtitle", ""),
            "data": {
                "articleId": _url_hash(article["url"])  # Must match v3_trending_pool doc ID
            },
            "sound": "default",
            "priority": "high",
            "categoryId": "story",  # Enables "Read Story" action button (iOS + Android)
        },
        headers={"Content-Type": "application/json"}
    )
    return response.json()
```

### Getting Users with Push Enabled

```python
def get_push_enabled_users(db):
    """Get all users who have push notifications enabled."""
    users = db.collection("user_profiles") \
        .where("pushNotificationsEnabled", "==", True) \
        .where("pushToken", "!=", None) \
        .stream()

    return [
        {"uid": doc.id, "token": doc.to_dict().get("pushToken")}
        for doc in users
        if doc.to_dict().get("pushToken")
    ]
```

### Example: Send Daily Trending Notification

```python
def send_daily_trending_notifications(db):
    """Send push notification for top trending article to all enabled users."""

    # Get today's top trending article
    today = datetime.now().strftime("%Y-%m-%d")
    global_feed = db.collection("v3_user_feeds").document("_global") \
        .collection("daily").document(today).get()

    if not global_feed.exists:
        return

    trending = global_feed.to_dict().get("trending", [])
    if not trending:
        return

    top_article = trending[0]

    # Get users with push enabled
    users = get_push_enabled_users(db)

    # Send to each user
    for user in users:
        send_push_notification(user["token"], top_article)
```

---

## Deep Link Flow

```
1. User taps notification
   ↓
2. App receives notification response
   ↓
3. Extract `articleId` from `data` payload
   ↓
4. Fetch article from `v3_trending_pool/{articleId}`
   ↓
5. Set article in store: setCurrentArticle(article)
   ↓
6. Navigate to article screen: router.push('/article')
```

---

## Configuration

### app.json

```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/images/notification-icon.png",
          "color": "#F59E0B"
        }
      ]
    ],
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      }
    },
    "android": {
      "googleServicesFile": "./google-services.json"
    }
  }
}
```

### Android Channel

```typescript
// Created in initializeNotifications()
Notifications.setNotificationChannelAsync('default', {
  name: 'Default',
  importance: Notifications.AndroidImportance.MAX,
  vibrationPattern: [0, 250, 250, 250],
  lightColor: '#F59E0B',
});
```

---

## Testing

### Local Test Notification

```typescript
import { scheduleLocalNotification } from '@/lib/notifications';

// Schedule a test notification (fires in 1 second)
await scheduleLocalNotification(
  'Test Notification',
  'This is a test',
  { articleId: 'abc123' }  // Use actual doc_id from v3_trending_pool
);
```

### Expo Push Tool

1. Get your push token from app logs (dev mode)
2. Go to https://expo.dev/notifications
3. Enter token and test payload

---

## TODO

- [ ] Create backend notification sender script
- [ ] Set up scheduled job (e.g., daily at 9am)
- [ ] Add notification analytics (opens, dismisses)
- [ ] Support for different notification types (breaking news, weekly digest)
- [ ] Rich notifications with images (iOS)

---

## Troubleshooting

### Token not registering
- Must be a physical device (not simulator/emulator for real tokens)
- Check permissions in device settings
- Verify EAS project ID in app.json

### Notification not appearing
- Check Android channel is created
- Verify `pushNotificationsEnabled: true` in Firestore
- Check Expo push receipt for errors

### Deep link not working
- Verify `articleId` in payload matches `v3_trending_pool` doc ID
- Check article exists in pool (not expired/deactivated)
- Ensure `is_active: true` on pool item
