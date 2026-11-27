import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChatbotWidget } from "@/components/chatbot/chatbot-widget";

const openChatbot = () => {
  render(<ChatbotWidget />);
  fireEvent.click(screen.getByRole("button", { name: "Open AI chatbot" }));

  return screen.getByRole("textbox", { name: "Message the AI chatbot" });
};

const ask = (input: HTMLElement, question: string) => {
  fireEvent.change(input, { target: { value: question } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
};

describe(ChatbotWidget, () => {
  it("keeps the send button disabled until there is a message", () => {
    openChatbot();

    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });

  it("shows the question beside a canned answer", () => {
    const input = openChatbot();

    ask(input, "How do I install a modpack?");

    expect(screen.getByText("How do I install a modpack?")).toBeInTheDocument();
    expect(screen.getByText(/I don't know\./u)).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("cycles through the three answers without ever helping", () => {
    const input = openChatbot();

    ask(input, "First");
    expect(screen.getByText(/I don't know\./u)).toBeInTheDocument();
    expect(screen.queryByText(/violates my content policies/u)).toBeNull();

    ask(input, "Second");
    expect(
      screen.getByText(/violates my content policies/u)
    ).toBeInTheDocument();

    ask(input, "Third");
    expect(
      screen.getByText(/not related to VoxelVein or associated services/u)
    ).toBeInTheDocument();
  });
});
