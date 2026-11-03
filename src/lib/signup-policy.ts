export type SignupMode = "open" | "invite";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function signupModeFrom(value: string | undefined): SignupMode {
  return value?.trim().toLowerCase() === "invite" ? "invite" : "open";
}

/**
 * Whether this email may create a new account. Existing accounts can always
 * sign in; this only decides sign-ups. The owner can always sign up.
 */
export function canCreateAccount(input: {
  email: string;
  mode: SignupMode;
  ownerEmail?: string | undefined;
  invited: boolean;
}): boolean {
  const email = normalizeEmail(input.email);
  if (input.ownerEmail && email === normalizeEmail(input.ownerEmail)) return true;
  return input.mode === "open" || input.invited;
}
