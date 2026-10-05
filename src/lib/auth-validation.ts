import { getUsernameProblem, USERNAME_PROBLEM_MESSAGES } from "@/lib/usernames";

/**
 * A deliberately loose address check: enough structure to catch a typo, not
 * enough to reject an address that really works.
 *
 * Every part is bounded because this runs on whatever arrives at the sign-in
 * and sign-up forms, and neither input caps its length. The unbounded form,
 * `[^\s@]+@[^\s@]+\.[^\s@]+$`, is quadratic on a long string with no `@` in
 * it: the engine retries each start position and rescans the rest of the
 * input every time. The bounds below are the RFC 5321 ones — a 64-octet
 * local part and 63-octet domain labels — so the cost is linear and the
 * accepted set barely moves.
 *
 * Kept in step by hand with the copies in `login.tsx` and `signup.tsx`, which
 * validate on the client before the request is made.
 */
const EMAIL_PATTERN = /^[^\s@]{1,64}@(?:[^\s@.]{1,63}\.)+[^\s@.]{1,63}$/u;
const MIN_PASSWORD_LENGTH = 8;

interface LoginFieldErrors {
  email?: string;
  password?: string;
}

interface SignupFieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

interface ProfileFieldErrors {
  name?: string;
  username?: string;
}

interface PasswordChangeFieldErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

const validateLoginInput = (
  email: string,
  password: string
): LoginFieldErrors => {
  const errors: LoginFieldErrors = {};

  if (!email.trim()) {
    errors.email = "Email is required.";
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!password) {
    errors.password = "Password is required.";
  }

  return errors;
};

const validateSignupInput = (
  name: string,
  email: string,
  password: string
): SignupFieldErrors => {
  const errors: SignupFieldErrors = {};

  if (!name.trim()) {
    errors.name = "Name is required.";
  }

  if (!email.trim()) {
    errors.email = "Email is required.";
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!password) {
    errors.password = "Password is required.";
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  return errors;
};

const validateProfileInput = (
  name: string,
  username: string
): ProfileFieldErrors => {
  const errors: ProfileFieldErrors = {};

  if (!name.trim()) {
    errors.name = "Name is required.";
  }

  if (username.trim()) {
    // Delegates to the shared checker rather than restating the rules. This
    // module previously kept its own copies of the length bounds, the pattern,
    // and the wording, so the profile form said "3-30 characters. Letters,
    // numbers, underscores, and periods." while this said "3-30 characters"
    // and "Use letters, numbers, underscores, or periods." — three sentences
    // for one rule, and the one on screen was not this one.
    const problem = getUsernameProblem(username);
    if (problem) {
      errors.username = USERNAME_PROBLEM_MESSAGES[problem];
    }
  } else {
    errors.username = "Username is required.";
  }

  return errors;
};

const validatePasswordChangeInput = (
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): PasswordChangeFieldErrors => {
  const errors: PasswordChangeFieldErrors = {};

  if (!currentPassword) {
    errors.currentPassword = "Current password is required.";
  }

  if (!newPassword) {
    errors.newPassword = "New password is required.";
  } else if (newPassword.length < MIN_PASSWORD_LENGTH) {
    errors.newPassword = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (!confirmPassword) {
    errors.confirmPassword = "Please confirm your new password.";
  } else if (newPassword && confirmPassword !== newPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
};

export {
  validateLoginInput,
  validatePasswordChangeInput,
  validateProfileInput,
  validateSignupInput,
};
