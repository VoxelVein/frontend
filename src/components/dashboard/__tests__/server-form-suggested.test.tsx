import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ServerForm } from "@/components/dashboard/server-form";

const { getSuggestedVersionsMock, saveServerDetailsMock, searchProjectsMock } =
  vi.hoisted(() => ({
    getSuggestedVersionsMock: vi.fn<() => Promise<string[]>>(),
    saveServerDetailsMock: vi.fn<() => Promise<void>>(),
    searchProjectsMock: vi.fn<() => Promise<unknown[]>>(),
  }));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Suggestions are fetched from Mojang; a stub keeps this suite on the form's trigger
vi.mock("@/lib/minecraft-versions.functions", () => ({
  getSuggestedMinecraftVersions: getSuggestedVersionsMock,
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Saving and project search reach the server; the form only needs their shapes
vi.mock("@/lib/projects.functions", () => ({
  saveServerDetails: saveServerDetailsMock,
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Project search reaches the database; the linked-content field only needs its shape
vi.mock("@/lib/project-search.functions", () => ({
  searchProjects: searchProjectsMock,
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Action feedback is a toast; a stub keeps the suite on the dialog
vi.mock("sonner", () => ({
  toast: {
    dismiss: vi.fn<() => void>(),
    error: vi.fn<(message: string) => void>(),
  },
}));

const PROJECT_ID = "0b8f7c1e-4b1a-4c7e-9a55-1c2d3e4f5a6b";

const renderForm = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return render(
    <ServerForm
      onSaved={vi.fn<() => Promise<void>>()}
      projectId={PROJECT_ID}
      server={null}
    />,
    { wrapper: Wrapper }
  );
};

describe(ServerForm, () => {
  beforeEach(() => {
    getSuggestedVersionsMock.mockReset().mockResolvedValue(["26.3", "1.21.8"]);
    saveServerDetailsMock.mockReset().mockResolvedValue();
    searchProjectsMock.mockReset().mockResolvedValue([]);
  });

  it("opens the version editor from the Add Suggested button", async () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Add Suggested" }));

    await expect(
      screen.findByText("Suggested Minecraft versions")
    ).resolves.toBeInTheDocument();
  });
});
