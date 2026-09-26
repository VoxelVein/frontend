import { passkeyClient } from "@better-auth/passkey/client";
import {
  adminClient,
  inferAdditionalFields,
  usernameClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import type { auth } from "./auth";
import { ac, admin, user } from "./permissions";

export const authClient = createAuthClient({
  plugins: [
    usernameClient(),
    passkeyClient(),
    adminClient({ ac, roles: { admin, user } }),
    inferAdditionalFields<typeof auth>(),
  ],
});
