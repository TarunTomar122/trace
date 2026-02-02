import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { firestore } from './firebase';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Timestamp | null;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;

  onboarded: boolean;
  name: string;
  role: string;
  company?: string;
  location?: string;
  experienceYears?: number | null;
  currentWork?: {
    project?: string;
    focus?: string;
    company?: string;
  };
  projects?: string[];
  goals?: {
    shortTerm?: string;
    longTerm?: string;
  };
  learningStyle?: string;
  attentionConstraints?: string;
  motivationTriggers?: string[];
  interests: string[];
  hobbies: string[];
  skills: string[];
  dislikedTopics: string[];

  sourcePreferences: {
    youtube: number;
    articles: number;
    papers: number;
    repos: number;
    tweets: number;
    discussions: number;
  };

  contentDepth: 'quick' | 'deep' | 'surprise' | null;
  contentPreferences?: {
    likes?: string[];
    dislikes?: string[];
  };
  favoriteSources?: string[];
  personalityTraits?: string[];
  petPeeves?: string[];

  insights?: {
    currentProjects?: string[];
    goals?: string[];
    skillLevel?: string;
    learningStyle?: string;
    preferredSources?: string[];
    additionalContext?: string;
  };

  traceSummary?: {
    text: string;
    updatedAt?: string;
    source?: string;
  };

  chatHistory?: ChatMessage[];

  subscriptionStatus: 'none' | 'trial' | 'active' | 'on_hold' | 'cancelled' | 'expired';
  subscriptionId: string | null;
  dodoCustomerId: string | null;
  planId: string | null;
  nextBillingDate: Timestamp | null;
  trialEndDate: Timestamp | null;
  lastPaymentDate: Timestamp | null;
  lastCheckoutSessionId: string | null;
  lastCheckoutCreatedAt: Timestamp | null;
  cancelledAt: Timestamp | null;
  willCancelAt: Timestamp | null;

  newsletterOptIn?: boolean;
  newsletterSendTime?: string;
  newsletterFrequency?: string;
  newsletterLastSentAt?: string | null;

  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  onboardedAt: Timestamp | null;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const docRef = doc(firestore, 'user_profiles', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
}

export async function createUserProfile(
  uid: string,
  email: string,
  displayName: string,
  photoURL: string | null
): Promise<UserProfile> {
  const profile: UserProfile = {
    uid,
    email,
    displayName,
    photoURL,
    onboarded: false,
    name: displayName || '',
    role: '',
    company: '',
    location: '',
    experienceYears: null,
    currentWork: {},
    projects: [],
    goals: {},
    learningStyle: '',
    attentionConstraints: '',
    motivationTriggers: [],
    interests: [],
    hobbies: [],
    skills: [],
    dislikedTopics: [],
    sourcePreferences: {
      youtube: 8,
      articles: 8,
      papers: 1,
      repos: 1,
      tweets: 5,
      discussions: 5,
    },
    contentDepth: null,
    contentPreferences: { likes: [], dislikes: [] },
    favoriteSources: [],
    personalityTraits: [],
    petPeeves: [],
    subscriptionStatus: 'none',
    subscriptionId: null,
    dodoCustomerId: null,
    planId: null,
    nextBillingDate: null,
    trialEndDate: null,
    lastPaymentDate: null,
    lastCheckoutSessionId: null,
    lastCheckoutCreatedAt: null,
    cancelledAt: null,
    willCancelAt: null,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
    onboardedAt: null,
  };

  try {
    const docRef = doc(firestore, 'user_profiles', uid);
    await setDoc(docRef, profile);
    return profile;
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw error;
  }
}

export async function getOrCreateUserProfile(
  uid: string,
  email: string,
  displayName: string,
  photoURL: string | null
): Promise<UserProfile> {
  const existing = await getUserProfile(uid);
  if (existing) {
    return existing;
  }
  return createUserProfile(uid, email, displayName, photoURL);
}

