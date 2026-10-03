import { describe, expect, it } from "vitest";

import {
  validateLoginInput,
  validatePasswordChangeInput,
  validateProfileInput,
  validateSignupInput,
} from "@/lib/auth-validation";
import { USERNAME_PROBLEM_MESSAGES } from "@/lib/usernames";

describe(validateLoginInput, () => {
  it("returns no errors for valid input", () => {
    expect(validateLoginInput("user@example.com", "password123")).toStrictEqual(
      {}
    );
  });

  it("requires an email", () => {
    expect(validateLoginInput("", "password123")).toStrictEqual({
      email: "Email is required.",
    });
  });

  it("rejects an invalid email", () => {
    expect(validateLoginInput("not-an-email", "password123")).toStrictEqual({
      email: "Enter a valid email address.",
    });
  });

  it("requires a password", () => {
    expect(validateLoginInput("user@example.com", "")).toStrictEqual({
      password: "Password is required.",
    });
  });

  it("reports all missing fields", () => {
    expect(validateLoginInput("", "")).toStrictEqual({
      email: "Email is required.",
      password: "Password is required.",
    });
  });
});

describe(validateSignupInput, () => {
  it("returns no errors for valid input", () => {
    expect(
      validateSignupInput("Test User", "user@example.com", "password123")
    ).toStrictEqual({});
  });

  it("requires a name", () => {
    expect(
      validateSignupInput("", "user@example.com", "password123")
    ).toStrictEqual({
      name: "Name is required.",
    });
  });

  it("requires an email", () => {
    expect(validateSignupInput("Test User", "", "password123")).toStrictEqual({
      email: "Email is required.",
    });
  });

  it("rejects an invalid email", () => {
    expect(
      validateSignupInput("Test User", "not-an-email", "password123")
    ).toStrictEqual({
      email: "Enter a valid email address.",
    });
  });

  it("requires a password", () => {
    expect(
      validateSignupInput("Test User", "user@example.com", "")
    ).toStrictEqual({
      password: "Password is required.",
    });
  });

  it("rejects a short password", () => {
    expect(
      validateSignupInput("Test User", "user@example.com", "short")
    ).toStrictEqual({
      password: "Password must be at least 8 characters.",
    });
  });

  it("reports all missing fields", () => {
    expect(validateSignupInput("", "", "")).toStrictEqual({
      email: "Email is required.",
      name: "Name is required.",
      password: "Password is required.",
    });
  });
});

describe(validateProfileInput, () => {
  it("returns no errors for valid input", () => {
    expect(validateProfileInput("Test User", "test_user")).toStrictEqual({});
  });

  it("requires a name", () => {
    expect(validateProfileInput("", "test_user")).toStrictEqual({
      name: "Name is required.",
    });
  });

  it("requires a username", () => {
    expect(validateProfileInput("Test User", "")).toStrictEqual({
      username: "Username is required.",
    });
  });

  // Asserted against the shared message table rather than literals: this
  // module used to keep its own wording, which is how the profile form and the
  // validator ended up disagreeing about the same rule.
  it("rejects a short username", () => {
    expect(validateProfileInput("Test User", "ab")).toStrictEqual({
      username: USERNAME_PROBLEM_MESSAGES["too-short"],
    });
  });

  it("rejects a long username", () => {
    expect(validateProfileInput("Test User", "a".repeat(31))).toStrictEqual({
      username: USERNAME_PROBLEM_MESSAGES["too-long"],
    });
  });

  it("rejects invalid username characters", () => {
    expect(validateProfileInput("Test User", "bad name!")).toStrictEqual({
      username: USERNAME_PROBLEM_MESSAGES.invalid,
    });
  });
});

describe(validatePasswordChangeInput, () => {
  it("returns no errors for valid input", () => {
    expect(
      validatePasswordChangeInput(
        "old-password",
        "new-password",
        "new-password"
      )
    ).toStrictEqual({});
  });

  it("requires the current password", () => {
    expect(
      validatePasswordChangeInput("", "new-password", "new-password")
    ).toStrictEqual({
      currentPassword: "Current password is required.",
    });
  });

  it("requires a new password", () => {
    expect(
      validatePasswordChangeInput("old-password", "", "new-password")
    ).toStrictEqual({
      newPassword: "New password is required.",
    });
  });

  it("rejects a short new password", () => {
    expect(
      validatePasswordChangeInput("old-password", "short", "short")
    ).toStrictEqual({
      newPassword: "Password must be at least 8 characters.",
    });
  });

  it("requires a confirmation", () => {
    expect(
      validatePasswordChangeInput("old-password", "new-password", "")
    ).toStrictEqual({
      confirmPassword: "Please confirm your new password.",
    });
  });

  it("rejects mismatched passwords", () => {
    expect(
      validatePasswordChangeInput("old-password", "new-password", "different")
    ).toStrictEqual({
      confirmPassword: "Passwords do not match.",
    });
  });
});
