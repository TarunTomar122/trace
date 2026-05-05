import PostHog from 'posthog-react-native';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';

// ─── PostHog Configuration ──────────────────────────────────────────────────
const POSTHOG_API_KEY = 'phc_mWemDemjuvfOijNjUpHfOqJUztivxUoi3qMExZXcwFx';
const POSTHOG_HOST = 'https://app.posthog.com';

const appVersion = Application.nativeApplicationVersion || Constants.expoConfig?.version || '1.0.0';
const appBuild = Application.nativeBuildVersion || '1';

const posthogClient = new PostHog(POSTHOG_API_KEY, {
  host: POSTHOG_HOST,
  // Flush events every 10 seconds or 20 events — good balance for mobile
  flushAt: 20,
  flushInterval: 10000,
  // Enable session recording (opt-in, can be disabled if needed)
  enableSessionReplay: false,
  // Capture app lifecycle events (installed, updated, opened, backgrounded)
  captureAppLifecycleEvents: true,
});

// Set default super properties on every event
posthogClient.register({
  $app_version: appVersion,
  $app_build: appBuild,
  $app_platform: Platform.OS,
  $app_name: 'Trace',
  app_source: 'trace_mobile',
});

console.log('[PostHog] Initialized eagerly for', Platform.OS, 'v' + appVersion);

// ─── Helpers ────────────────────────────────────────────────────────────────

export function getPostHog(): PostHog {
  return posthogClient;
}

export function trackEvent(
  event: string,
  properties?: Record<string, any>
): void {
  posthogClient.capture(event, properties);
}

export function identifyUser(
  distinctId: string,
  properties?: Record<string, any>
): void {
  posthogClient.identify(distinctId, properties);
}

export function resetUser(): void {
  posthogClient.reset();
}

export function trackScreen(name: string, properties?: Record<string, any>): void {
  posthogClient.screen(name, properties);
}

export function setUserProperty(
  properties: Record<string, any>
): void {
  posthogClient.setPersonProperties(properties);
}
