import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ReportDialog } from "@/components/reports/report-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Links need a router instance; a plain anchor keeps this suite on the primitives
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The dialog posts to a server function; string paths avoid strict factory type-checking
vi.mock("@/lib/reports.functions", () => ({
  createReport: vi.fn<(opts: { data: unknown }) => Promise<void>>(),
}));

/**
 * These assertions are about class lists, which is deliberate and unusual.
 *
 * The defect they guard is a *missing* class, not wrong behaviour: a dropdown
 * whose animation is switched off still opens, still closes, still traps focus
 * and still passes every behavioural test. It simply appears instantly, which
 * is the thing nobody catches in a test and everybody notices on screen.
 */
const openMenu = (children: ReactNode) =>
  render(
    <DropdownMenu onOpenChange={vi.fn<() => void>()} open>
      <DropdownMenuTrigger />
      <DropdownMenuContent>{children}</DropdownMenuContent>
    </DropdownMenu>
  );

describe("dropdown motion", () => {
  it("does not switch off its own enter animation", () => {
    openMenu(<DropdownMenuItem>One</DropdownMenuItem>);

    const popup = document.querySelector('[data-slot="dropdown-menu-content"]');
    const className = popup?.className ?? "";

    // `animate-none` compiles to `animation: none !important`, and it was
    // declared on the same element as `data-open:animate-in`. The important
    // flag won, so the menu had an animation written on it that could never run.
    expect(className).toContain("data-open:animate-in");
    expect(className).not.toContain("animate-none!");
  });

  it("still animates on the way out", () => {
    openMenu(<DropdownMenuItem>One</DropdownMenuItem>);

    const className = document.querySelector(
      '[data-slot="dropdown-menu-content"]'
    )?.className;

    expect(className).toContain("data-closed:animate-out");
  });

  it("transitions an item's highlight instead of snapping it", () => {
    openMenu(<DropdownMenuItem>One</DropdownMenuItem>);

    const item = document.querySelector('[data-slot="dropdown-menu-item"]');
    const className = item?.className ?? "";

    // Moving between items is the interaction people notice most: without a
    // transition the highlight jumps rather than travelling.
    expect(className).toContain("transition-colors");
    expect(className).toContain("data-highlighted:bg-accent");
  });
});

describe("report dialog motion", () => {
  it("transitions the reason row rather than snapping it", async () => {
    render(
      <ReportDialog
        projectId="p1"
        targetKind="project"
        targetLabel="this mod"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /report/iu }));

    // The dialog renders through a portal once it has opened, so the row is not
    // in the document on the click.
    const radio = await screen.findByRole("radio", { name: /spam/iu });
    const label = radio.closest("label");
    const className = label?.className ?? "";

    expect(className).toContain("transition-colors");
    expect(className).toContain("duration-150");
    // Keyboard focus lands on the radio too, so the row has to light up for
    // that as well as for a pointer.
    expect(className).toContain("focus-within:bg-muted/60");
  });
});
