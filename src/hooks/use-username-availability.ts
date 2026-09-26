import { useDebouncedValue } from "@tanstack/react-pacer/debouncer";
import { useQuery } from "@tanstack/react-query";
import { check, pipe, string } from "valibot";

import { checkUsername } from "@/lib/account.functions";
import { getUsernameProblem, USERNAME_PROBLEM_MESSAGES } from "@/lib/usernames";

/** How long typing settles before the server is asked. */
const USERNAME_CHECK_DEBOUNCE_MS = 400;

/** A checked name stays fresh for half a minute, so retyping it is instant. */
const USERNAME_CHECK_STALE_MS = 30_000;

/** Form validation for a username field, using the shared rules. */
export const usernameSchema = pipe(
  string(),
  check((value) => value.trim().length > 0, "Username is required."),
  check(
    (value) => getUsernameProblem(value) !== "too-short",
    USERNAME_PROBLEM_MESSAGES["too-short"]
  ),
  check(
    (value) => getUsernameProblem(value) !== "too-long",
    USERNAME_PROBLEM_MESSAGES["too-long"]
  ),
  check(
    (value) => getUsernameProblem(value) !== "invalid",
    USERNAME_PROBLEM_MESSAGES.invalid
  ),
  check(
    (value) => getUsernameProblem(value) !== "reserved",
    USERNAME_PROBLEM_MESSAGES.reserved
  )
);

export type UsernameAvailability =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available" }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

interface UsernameAvailabilityOptions {
  /** False skips checking entirely, for example during the cooldown. */
  enabled?: boolean;
  /** The user's current username; typing it back is not re-checked. */
  currentUsername?: string | null;
}

const IDLE: UsernameAvailability = { status: "idle" };
const CHECKING: UsernameAvailability = { status: "checking" };

/**
 * Live availability of a username as the user types. Format problems are
 * left to the form's own validation, so this only reports what the server
 * knows: whether the name is free.
 */
export const useUsernameAvailability = (
  value: string,
  { currentUsername, enabled = true }: UsernameAvailabilityOptions = {}
): UsernameAvailability => {
  const trimmed = value.trim();
  const [debounced] = useDebouncedValue(trimmed, {
    wait: USERNAME_CHECK_DEBOUNCE_MS,
  });

  const isUnchanged = currentUsername === trimmed;
  const isCheckable = enabled && !isUnchanged && !getUsernameProblem(trimmed);
  const isSettled = debounced === trimmed;

  const { data, isError } = useQuery({
    enabled: isCheckable && isSettled,
    queryFn: () => checkUsername({ data: { username: debounced } }),
    queryKey: ["username-check", debounced],
    retry: false,
    staleTime: USERNAME_CHECK_STALE_MS,
  });

  if (!isCheckable) {
    return IDLE;
  }
  if (!isSettled) {
    return CHECKING;
  }
  if (isError) {
    return {
      message: "Could not check availability right now.",
      status: "error",
    };
  }
  if (!data) {
    return CHECKING;
  }
  return data.available
    ? { status: "available" }
    : { message: data.message, status: "unavailable" };
};
