import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
/* oxlint-disable anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Server functions and auth are network boundaries; exercise the real thread UI and query cache. */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { PostComments } from "@/components/blog/post-comments";
import type { CommentView } from "@/lib/comments.functions";

interface CommentMocks {
  create: Mock<() => Promise<CommentView>>;
  list: Mock<() => Promise<CommentView[]>>;
  session: { user: { id: string; name: string; role: string } } | null;
  toggle: Mock<() => Promise<{ heartCount: number; hearted: boolean }>>;
}

const comment = (overrides: Partial<CommentView> = {}): CommentView => ({
  authorName: "Player",
  authorRole: "user",
  body: "Great article",
  createdAt: "2026-01-01T00:00:00.000Z",
  heartCount: 0,
  heartedByMe: false,
  id: "comment-1",
  parentId: null,
  postId: "post-1",
  ...overrides,
});

const mocks = vi.hoisted((): CommentMocks => ({
  create: vi.fn<() => Promise<CommentView>>(),
  list: vi.fn<() => Promise<CommentView[]>>(),
  session: { user: { id: "user", name: "Player", role: "user" } },
  toggle: vi.fn<() => Promise<{ heartCount: number; hearted: boolean }>>(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: mocks.session }) },
}));

vi.mock("@/lib/comments.functions", () => ({
  createPostComment: mocks.create,
  listPostComments: mocks.list,
  toggleCommentHeart: mocks.toggle,
}));

const mount = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
          },
        })
      }
    >
      <PostComments postId="post-1" />
    </QueryClientProvider>
  );

describe("blog comments", () => {
  beforeEach(() => {
    mocks.session = { user: { id: "user", name: "Player", role: "user" } };
    mocks.list.mockResolvedValue([comment()]);
    mocks.create.mockReset();
    mocks.toggle.mockReset();
  });

  it("asks visitors to sign in and still shows the thread", async () => {
    mocks.session = null;
    mount();

    await expect(
      screen.findByRole("link", { name: "Sign in" })
    ).resolves.toHaveAttribute("href", "/login");
    await expect(
      screen.findByText("Great article")
    ).resolves.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reply" })).toBeNull();
  });

  it("marks staff names and lets staff heart a comment", async () => {
    mocks.session = { user: { id: "admin", name: "Ada", role: "admin" } };
    mocks.list.mockResolvedValue([
      comment({ authorName: "Ada", authorRole: "admin" }),
    ]);
    mocks.toggle.mockResolvedValue({ heartCount: 1, hearted: true });
    mount();

    await expect(screen.findAllByText("Admin")).resolves.toHaveLength(2);
    fireEvent.click(await screen.findByRole("button", { name: "Give heart" }));

    await waitFor(() =>
      expect(mocks.toggle).toHaveBeenCalledWith({
        data: { commentId: "comment-1" },
      })
    );
  });

  it("nests a reply under the comment it answers", async () => {
    mocks.list.mockResolvedValue([
      comment(),
      comment({
        authorName: "Another player",
        body: "I agree",
        id: "comment-2",
        parentId: "comment-1",
      }),
    ]);
    mocks.create.mockResolvedValue(
      comment({ id: "comment-3", body: "Me too" })
    );
    mount();

    await screen.findByText("I agree");
    const nested = screen.getByText("I agree").closest("ul")?.className;
    expect(nested).toContain("ml-4");

    fireEvent.click(
      screen.getAllByRole("button", { name: "Reply" })[0] ?? document.body
    );
    fireEvent.change(await screen.findByLabelText("Write a reply"), {
      target: { value: "Me too" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Post reply" }));

    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith({
        data: { body: "Me too", parentId: "comment-1", postId: "post-1" },
      })
    );
  });

  it("keeps blocked words out of comments with an inline error", async () => {
    mocks.create.mockResolvedValue(comment({ body: "Fine" }));
    mount();

    fireEvent.change(await screen.findByLabelText("Join the discussion"), {
      target: { value: "what the fuck" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));

    await expect(screen.findByRole("alert")).resolves.toHaveTextContent(
      "Please avoid offensive language."
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
