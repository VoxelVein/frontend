import { IconRobot, IconSend } from "@tabler/icons-react";
import { useState } from "react";
import type { FormEvent } from "react";

import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { replyForTurn } from "@/lib/chatbot-response";

interface ChatMessage {
  id: number;
  author: "user" | "bot";
  text: string;
}

const MessageBubble = ({ message }: { message: ChatMessage }) => (
  <Bubble
    align={message.author === "user" ? "end" : "start"}
    variant={message.author === "user" ? "default" : "muted"}
    className="max-w-full"
  >
    <BubbleContent>{message.text}</BubbleContent>
  </Bubble>
);

/**
 * The joke assistant in the corner, where the account dock used to be.
 *
 * Nothing here talks to a model: the reply comes from `replyForTurn`, so every
 * answer is one of three fixed jokes. The panel is a non-modal popover, which
 * leaves the page usable and lets Base UI return focus to the trigger on close.
 */
const ChatbotWidget = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const question = draft.trim();

    if (!question) {
      return;
    }

    // Two messages are added per question, so their count is the next turn.
    const nextTurn = messages.length / 2 + 1;

    setMessages((current) => [
      ...current,
      { author: "user", id: nextTurn * 2 - 1, text: question },
      {
        author: "bot",
        id: nextTurn * 2,
        text: replyForTurn(nextTurn - 1).message,
      },
    ]);
    setDraft("");
  };

  return (
    <div className="fixed right-4 bottom-4 z-50">
      <Popover>
        <PopoverTrigger
          render={
            <Button
              aria-label="Open AI chatbot"
              className="size-12 rounded-full shadow-lg transition-transform duration-200 hover:scale-105 active:scale-95 motion-reduce:transform-none motion-reduce:transition-none"
              size="icon-lg"
              type="button"
              variant="secondary"
            />
          }
        >
          <IconRobot aria-hidden="true" size={22} stroke={1.8} />
        </PopoverTrigger>

        <PopoverContent
          align="end"
          className="w-[min(22rem,calc(100vw-2rem))] gap-0 p-0"
          side="top"
          sideOffset={12}
        >
          <div className="border-border/70 flex items-center gap-2.5 border-b px-3 py-2.5">
            <IconRobot
              aria-hidden="true"
              className="text-primary shrink-0"
              size={20}
              stroke={1.8}
            />
            <PopoverHeader className="min-w-0 flex-1">
              <PopoverTitle>AI chatbot</PopoverTitle>
              <PopoverDescription>Guaranteed not to help.</PopoverDescription>
            </PopoverHeader>
          </div>

          <div
            aria-label="Chat messages"
            aria-live="polite"
            className="flex max-h-64 min-h-24 flex-col gap-2 overflow-y-auto p-3"
          >
            {messages.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Ask a question to get started.
              </p>
            ) : (
              messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))
            )}
          </div>

          <form
            className="border-border/70 flex items-center gap-2 border-t p-2"
            onSubmit={handleSubmit}
          >
            <label className="sr-only" htmlFor="chatbot-message">
              Message the AI chatbot
            </label>
            <Input
              autoComplete="off"
              id="chatbot-message"
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask the chatbot…"
              value={draft}
            />
            <Button
              aria-label="Send message"
              disabled={!draft.trim()}
              size="icon-sm"
              type="submit"
            >
              <IconSend aria-hidden="true" size={16} stroke={1.8} />
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export { ChatbotWidget };
