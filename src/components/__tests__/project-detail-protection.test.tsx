import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectDetail } from "@/components/projects/project-detail";
import type { ProjectView } from "@/lib/projects";

interface SessionStub {
  data: { user: { id: string; role: string } } | null;
}

const { setProjectProtectedMock, useSessionMock } = vi.hoisted(() => ({
  setProjectProtectedMock:
    vi.fn<
      (opts: {
        data: { isProtected: boolean; projectId: string };
      }) => Promise<void>
    >(),
  useSessionMock: vi.fn<() => SessionStub>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The page talks to server functions; string paths avoid strict factory type-checking against the server function types
vi.mock("@/lib/projects.functions", () => ({
  setProjectProtected: setProjectProtectedMock,
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The report dialog posts to a server function; this suite is about the moderation controls, so the call is stubbed rather than exercised
vi.mock("@/lib/reports.functions", () => ({
  createReport: vi.fn<(opts: { data: unknown }) => Promise<void>>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The session comes from Better Auth over the network; a stub picks the signed-in role per test
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: useSessionMock },
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Links need a router instance; a plain anchor keeps the test on the moderation controls
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));

const PROJECT: ProjectView = {
  author: "Alice",
  authorUsername: "alice",
  category: "utility",
  description: "",
  downloads: 10,
  gallery: [],
  icon: null,
  id: "0b8f7c1e-4b1a-4c7e-9a55-1c2d3e4f5a6b",
  isProtected: false,
  name: "Big Mod",
  ownerId: "user-alice",
  pendingDeletion: false,
  server: null,
  publishedAt: "2026-09-01T00:00:00.000Z",
  rejectionReason: null,
  slug: "big-mod",
  status: "published",
  summary: "A big mod.",
  tags: [],
  type: "mod",
  updatedAt: "2026-09-01T00:00:00.000Z",
  versions: [],
};

const signInAs = (role: string) => {
  useSessionMock.mockReturnValue({ data: { user: { id: "someone", role } } });
};

describe(ProjectDetail, () => {
  beforeEach(() => {
    setProjectProtectedMock.mockReset().mockResolvedValue();
    useSessionMock.mockReset();
  });

  it("hides the protection control from non-admins", () => {
    signInAs("user");
    render(<ProjectDetail project={{ ...PROJECT, isProtected: true }} />);

    expect(
      screen.queryByRole("button", {
        name: /protecting this project|Protect from owner deletion/u,
      })
    ).toBeNull();
    expect(screen.queryByText("Protected project")).toBeNull();
  });

  it("lets an admin protect a project from owner deletion", async () => {
    signInAs("admin");
    render(<ProjectDetail project={PROJECT} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Protect from owner deletion" })
    );

    await waitFor(() => {
      expect(setProjectProtectedMock).toHaveBeenCalledWith({
        data: { isProtected: true, projectId: PROJECT.id },
      });
    });
    await expect(
      screen.findByRole("button", { name: "Stop protecting this project" })
    ).resolves.toBeTruthy();
    expect(screen.getByText("Protected project")).toBeInTheDocument();
  });

  it("tells admins when the project is scheduled for deletion", () => {
    signInAs("admin");
    render(<ProjectDetail project={{ ...PROJECT, pendingDeletion: true }} />);

    expect(
      screen.getByText("Scheduled for deletion when its owner's account is.")
    ).toBeTruthy();
  });
});
