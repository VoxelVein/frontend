import { IconBrandGithub, IconBrandGoogle } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import type { ComponentType } from "react";

import { authClient } from "@/lib/auth-client";

export type SocialProviderId = "github" | "google";

export interface SocialProvider {
  clientId: () => string;
  icon: ComponentType<{ "aria-hidden"?: boolean; size?: number }>;
  id: SocialProviderId;
  label: string;
}

export interface LinkedAccount {
  id: string;
  providerId: string;
}

export const LINKED_ACCOUNTS_QUERY_KEY = ["linked-accounts"] as const;
export const ACCOUNT_DELETION_CONTEXT_QUERY_KEY = [
  "account-deletion-context",
] as const;

// SAFETY: Vite exposes VITE_* vars as `any`; narrowing to string | undefined
// matches the runtime value (string when set, undefined when absent). Read
// lazily so the value reflects the current environment, including in tests.
const SOCIAL_PROVIDERS: readonly SocialProvider[] = [
  {
    clientId: () =>
      (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ??
      "",
    icon: IconBrandGoogle,
    id: "google",
    label: "Google",
  },
  {
    clientId: () =>
      (import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined)?.trim() ??
      "",
    icon: IconBrandGithub,
    id: "github",
    label: "GitHub",
  },
];

/** Google and GitHub, limited to those configured for this deployment. */
export const getConfiguredSocialProviders = (): SocialProvider[] =>
  SOCIAL_PROVIDERS.filter((provider) => provider.clientId().length > 0);

const fetchLinkedAccounts = async (): Promise<LinkedAccount[]> => {
  const { data, error } = await authClient.listAccounts();
  if (error) {
    throw new Error(error.message ?? "Could not load your sign-in methods.");
  }
  return (data ?? []).map((account) => ({
    id: account.id,
    providerId: account.providerId,
  }));
};

/** The accounts (password, Google, GitHub) linked to the signed-in user. */
export const useLinkedAccounts = () =>
  useQuery({
    queryFn: fetchLinkedAccounts,
    queryKey: LINKED_ACCOUNTS_QUERY_KEY,
  });
