/**
 * Name of the hidden trap field on the email signup forms (components/SignupTrap.tsx, checked in
 * lib/signup-guard.ts). Its own file so the browser bundle gets this string and nothing of the guard.
 * Deliberately not a name autofill recognises ("website", "url", "company"...).
 */
export const TRAP_FIELD = 'hp_note';
