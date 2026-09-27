import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { GameVersionPicker } from "@/components/dashboard/game-version-picker";
import { getReleasesInLine } from "@/lib/minecraft-versions";

const ADD_LINE = /add all 1\.20\.x releases/iu;
const SHOW_SNAPSHOTS = /show snapshots/iu;
const SNAPSHOT_OPTION = /24w14a/iu;

const NO_VERSIONS: string[] = [];

const Harness = ({
  initial = NO_VERSIONS,
  onChange,
}: {
  initial?: string[];
  onChange?: (values: string[]) => void;
}) => {
  const [values, setValues] = useState(initial);
  return (
    <GameVersionPicker
      id="versions"
      values={values}
      onChange={(next) => {
        setValues(next);
        onChange?.(next);
      }}
    />
  );
};

const typeQuery = (value: string) => {
  const input = screen.getByRole("combobox", { name: "Game versions" });
  fireEvent.change(input, { target: { value } });
  // jsdom input events do not open the popup the way real typing does.
  fireEvent.keyDown(input, { key: "ArrowDown" });
  return input;
};

describe(GameVersionPicker, () => {
  it("adds every release of a line from one option", async () => {
    const onChange = vi.fn<(values: string[]) => void>();
    render(<Harness onChange={onChange} />);

    typeQuery("1.20");
    fireEvent.click(await screen.findByRole("option", { name: ADD_LINE }));

    expect(onChange).toHaveBeenLastCalledWith(getReleasesInLine("1.20"));
  });

  it("adds a single version and shows it as a removable chip", async () => {
    render(<Harness />);

    typeQuery("1.19.4");
    fireEvent.click(await screen.findByRole("option", { name: "1.19.4" }));

    const remove = screen.getByRole("button", { name: "Remove 1.19.4" });
    fireEvent.click(remove);
    expect(
      screen.queryByRole("button", { name: "Remove 1.19.4" })
    ).not.toBeInTheDocument();
  });

  it("hides snapshots until they are switched on", async () => {
    render(<Harness />);

    const input = typeQuery("24w14");
    expect(
      screen.queryByRole("option", { name: SNAPSHOT_OPTION })
    ).not.toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Escape" });

    fireEvent.click(screen.getByRole("checkbox", { name: SHOW_SNAPSHOTS }));
    typeQuery("24w14a");
    await expect(
      screen.findByRole("option", { name: SNAPSHOT_OPTION })
    ).resolves.toBeInTheDocument();
  });

  it("clears every selection at once", () => {
    render(<Harness initial={["1.21", "1.20.1"]} />);

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(
      screen.queryByRole("button", { name: "Remove 1.21" })
    ).not.toBeInTheDocument();
  });

  it("announces errors on the input", () => {
    render(
      <GameVersionPicker
        id="versions"
        values={[]}
        onChange={vi.fn<(values: string[]) => void>()}
        error="Choose at least one game version."
      />
    );

    const input = screen.getByRole("combobox", { name: "Game versions" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(within(document.body).getByRole("alert")).toHaveTextContent(
      "Choose at least one game version."
    );
  });
});
