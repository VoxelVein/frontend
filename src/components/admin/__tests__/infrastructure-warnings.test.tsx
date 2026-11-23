import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InfrastructureWarnings } from "@/components/admin/infrastructure-warnings";
import type { InfrastructureStatus } from "@/lib/infrastructure.functions";

const { getStatusMock } = vi.hoisted(() => ({
  getStatusMock: vi.fn<() => Promise<InfrastructureStatus>>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Infrastructure status is read from server env; a stub keeps this suite on what the banners say
vi.mock("@/lib/infrastructure.functions", () => ({
  getInfrastructureStatus: getStatusMock,
}));

const healthy: InfrastructureStatus = {
  redisConfigured: true,
  redisReady: true,
  storageConfigured: true,
};

const renderWarnings = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return render(<InfrastructureWarnings />, { wrapper: Wrapper });
};

describe(InfrastructureWarnings, () => {
  beforeEach(() => {
    getStatusMock.mockReset().mockResolvedValue(healthy);
  });

  it("says nothing when both services are healthy", async () => {
    renderWarnings();

    await vi.waitFor(() => expect(getStatusMock).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("warns when Redis is not configured", async () => {
    getStatusMock.mockResolvedValue({
      ...healthy,
      redisConfigured: false,
      redisReady: false,
    });
    renderWarnings();

    await expect(
      screen.findByText(/Redis \(Valkey\) is not configured/u)
    ).resolves.toBeInTheDocument();
    expect(screen.queryByText(/File storage is unavailable/u)).toBeNull();
  });

  it("warns when Redis is configured but disconnected", async () => {
    getStatusMock.mockResolvedValue({ ...healthy, redisReady: false });
    renderWarnings();

    await expect(
      screen.findByText(/configured but disconnected/u)
    ).resolves.toBeInTheDocument();
  });

  it("warns when object storage is not configured", async () => {
    getStatusMock.mockResolvedValue({ ...healthy, storageConfigured: false });
    renderWarnings();

    await expect(
      screen.findByText(/S3-compatible object storage is not configured/u)
    ).resolves.toBeInTheDocument();
    expect(
      screen.queryByText(/Cache and live updates are unavailable/u)
    ).toBeNull();
  });

  it("shows both banners when both services are down", async () => {
    getStatusMock.mockResolvedValue({
      redisConfigured: false,
      redisReady: false,
      storageConfigured: false,
    });
    renderWarnings();

    await expect(screen.findAllByRole("alert")).resolves.toHaveLength(2);
  });
});
