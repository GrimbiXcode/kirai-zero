import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const KEY = "kirai.session";

/**
 * On the web the session lives in a httpOnly cookie the browser manages, so
 * there is nothing for the app to hold — and nothing an XSS could read.
 *
 * The native builds cannot use that cookie: they run from `capacitor://
 * localhost` and are cross-origin to the API. There the bearer token is kept in
 * Capacitor Preferences, which is backed by the Keychain on iOS and by
 * SharedPreferences on Android.
 */
export const usesBearerToken = Capacitor.isNativePlatform();

let cached: string | null = null;

export async function loadToken(): Promise<string | null> {
  if (!usesBearerToken) return null;
  if (cached) return cached;
  const { value } = await Preferences.get({ key: KEY });
  cached = value;
  return value;
}

export async function saveToken(token: string): Promise<void> {
  if (!usesBearerToken) return;
  cached = token;
  await Preferences.set({ key: KEY, value: token });
}

export async function clearToken(): Promise<void> {
  cached = null;
  if (!usesBearerToken) return;
  await Preferences.remove({ key: KEY });
}
