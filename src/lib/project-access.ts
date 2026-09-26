import { eq } from "drizzle-orm";

import { db } from "@/db";
import { projects } from "@/db/schema";
import { auth } from "@/lib/auth";

export type Session = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>;

export const PROJECT_ACCESS_ERROR = {
  forbidden: "forbidden",
  notFound: "not-found",
  unauthenticated: "unauthenticated",
  unverified: "unverified",
} as const;

export type ProjectAccessErrorCode =
  (typeof PROJECT_ACCESS_ERROR)[keyof typeof PROJECT_ACCESS_ERROR];

const MESSAGES = {
  forbidden: "You can only change your own projects.",
  "not-found": "Project not found.",
  unauthenticated: "Sign in to manage projects.",
  unverified: "Verify your email address before publishing content.",
} as const satisfies Record<ProjectAccessErrorCode, string>;

export const HTTP_STATUS_BY_ACCESS_ERROR = {
  forbidden: 403,
  "not-found": 404,
  unauthenticated: 401,
  unverified: 403,
} as const satisfies Record<ProjectAccessErrorCode, number>;

export class ProjectAccessError extends Error {
  readonly code: ProjectAccessErrorCode;

  constructor(code: ProjectAccessErrorCode) {
    super(MESSAGES[code]);
    this.name = "ProjectAccessError";
    this.code = code;
  }
}

export const isAdmin = (session: Session): boolean =>
  session.user.role === "admin";

/** Signed-in user allowed to publish content: verified email or admin. */
export const requireUploader = async (headers: Headers): Promise<Session> => {
  const session = await auth.api.getSession({ headers });
  if (!session) {
    throw new ProjectAccessError(PROJECT_ACCESS_ERROR.unauthenticated);
  }
  if (!session.user.emailVerified && !isAdmin(session)) {
    throw new ProjectAccessError(PROJECT_ACCESS_ERROR.unverified);
  }
  return session;
};

/** Loads a project the session may change (owner or admin). */
export const requireEditableProject = async (
  session: Session,
  projectId: string
): Promise<typeof projects.$inferSelect> => {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project || project.status === "removed") {
    throw new ProjectAccessError(PROJECT_ACCESS_ERROR.notFound);
  }
  if (project.ownerId !== session.user.id && !isAdmin(session)) {
    throw new ProjectAccessError(PROJECT_ACCESS_ERROR.forbidden);
  }
  return project;
};
