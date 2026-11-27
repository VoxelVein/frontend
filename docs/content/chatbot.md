# Chatbot

The bottom-right corner holds a small **AI chatbot** button. It is a joke, not
an assistant: there is no model, no API key, no network request and no
knowledge of VoxelVein behind it. Every reply is one of three fixed answers.

## Why it never helps

The point of the widget is the punchline, so it must never accidentally give a
useful answer. `src/lib/chatbot-response.ts` holds all three replies and the
whole selection rule. The component only calls `replyForTurn(turn)`; it never
reads the message text. A future change that tries to "improve" the bot would
have to change that pure function, which is covered by unit tests asserting
that exactly three answers exist.

## The three answers

1. Turn 1: "I don't know."
2. Turn 2: "This request violates my content policies."
3. Turn 3: "This request is not related to VoxelVein or associated
   services."

Each answer is a short paragraph rather than a bare slogan. Turns cycle, so
the fourth question gets the first answer again. The text typed into the field
is deliberately ignored: it is only kept so the conversation reads naturally.

## The widget

`ChatbotWidget` is a non-modal popover anchored where the account dock used to
be. It is visible to signed-out visitors too, since it needs no account. The
trigger, panel and input use the shared `Button`, `Popover`, `Bubble` and
`Input` primitives, so focus is returned to the trigger on close and Esc
dismisses the panel. The transcript is an `aria-live="polite"` region and the
single input has a visually hidden label.

## Tests

* `src/lib/__tests__/chatbot-response.test.ts`, the three answers, cycling and
  the negative-turn boundary.
* `src/components/__tests__/chatbot-widget.test.tsx`, opening the panel, the
  disabled send button, and the rotating answers shown beside the question.
