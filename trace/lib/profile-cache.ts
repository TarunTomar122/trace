import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_INTERESTS_PREFIX = 'trace_profile_interests_v1:';
const PROFILE_BOOT_PREFIX = 'trace_profile_boot_v1:';

function profileInterestsKey(uid: string): string {
  return `${PROFILE_INTERESTS_PREFIX}${uid}`;
}

function profileBootKey(uid: string): string {
  return `${PROFILE_BOOT_PREFIX}${uid}`;
}

function sanitizeInterests(interests: unknown): string[] {
  if (!Array.isArray(interests)) return [];

  const normalized = interests
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

export async function readCachedProfileInterests(uid: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(profileInterestsKey(uid));
    if (!raw) return [];
    return sanitizeInterests(JSON.parse(raw));
  } catch (error) {
    console.warn('[ProfileCache] Failed to read cached interests:', error);
    return [];
  }
}

export async function writeCachedProfileInterests(uid: string, interests: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      profileInterestsKey(uid),
      JSON.stringify(sanitizeInterests(interests))
    );
  } catch (error) {
    console.warn('[ProfileCache] Failed to write cached interests:', error);
  }
}

export async function clearCachedProfileInterests(uid: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(profileInterestsKey(uid));
  } catch (error) {
    console.warn('[ProfileCache] Failed to clear cached interests:', error);
  }
}

interface CachedBootProfile {
  onboarded: boolean;
  interests: string[];
  updatedAt: number;
}

export async function readCachedBootProfile(uid: string): Promise<CachedBootProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(profileBootKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedBootProfile>;
    return {
      onboarded: parsed.onboarded === true,
      interests: sanitizeInterests(parsed.interests),
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    };
  } catch (error) {
    console.warn('[ProfileCache] Failed to read cached boot profile:', error);
    return null;
  }
}

export async function writeCachedBootProfile(
  uid: string,
  onboarded: boolean,
  interests: string[],
): Promise<void> {
  try {
    const payload: CachedBootProfile = {
      onboarded,
      interests: sanitizeInterests(interests),
      updatedAt: Date.now(),
    };
    await AsyncStorage.setItem(profileBootKey(uid), JSON.stringify(payload));
  } catch (error) {
    console.warn('[ProfileCache] Failed to write cached boot profile:', error);
  }
}

export async function clearCachedBootProfile(uid: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(profileBootKey(uid));
  } catch (error) {
    console.warn('[ProfileCache] Failed to clear cached boot profile:', error);
  }
}
