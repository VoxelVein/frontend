import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { auth } from "@/lib/auth";
import { can } from "@/lib/roles";

export const getSession = createServerFn({ method: "GET" }).handler(
  async () => {
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });

    return session;
  }
);

export const ensureSession = createServerFn({ method: "GET" }).handler(
  async () => {
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });

    if (!session) {
      throw new Error("Unauthorized");
    }

    return session;
  }
);

/**
 * The caller's session when they may open the admin panel, else null.
 *
 * The bar is moderator, so a moderator gets the panel and its Reviews and
 * Posts tabs; the tabs they cannot use are not rendered.
 */
export const requireAdmin = createServerFn({ method: "GET" }).handler(
  async () => {
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });

    if (!session) {
      return null;
    }

    if (!can(session.user.role, "viewAdminPanel")) {
      return null;
    }

    return session;
  }
);

export const listPasskeys = createServerFn({ method: "GET" }).handler(
  async () => {
    const headers = getRequestHeaders();
    const passkeys = await auth.api.listPasskeys({ headers });

    // Strip sensitive WebAuthn fields before sending them to the client
    return passkeys.map(({ createdAt, deviceType, id, name }) => ({
      createdAt,
      deviceType,
      id,
      name,
    }));
  }
);
