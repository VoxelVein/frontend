/**
 * The corner chatbot is a joke, not an assistant. It never reads the message,
 * calls a model, or looks anything up: every reply is one of these three fixed
 * answers. Keeping the choice in a pure function makes that promise testable,
 * so a future "helpful" branch cannot slip in unnoticed.
 */
interface ChatbotReply {
  kind: "unknown" | "policy" | "off-topic";
  message: string;
}

const UNKNOWN_REPLY: ChatbotReply = {
  kind: "unknown",
  message:
    "I don't know. I have no idea about that, and I'm not going to pretend otherwise. Ask me something else — though fair warning, the odds of a useful answer are not in your favour.",
};

const POLICY_REPLY: ChatbotReply = {
  kind: "policy",
  message:
    "This request violates my content policies. I'm not able to help with that, and I'm not going to explain the rules in a way that helps you work around them. Try a different question.",
};

const OFF_TOPIC_REPLY: ChatbotReply = {
  kind: "off-topic",
  message:
    "This request is not related to VoxelVein or associated services. I only pretend to know about mods, modpacks, plugins, shaders, resource packs, servers and datapacks — and even that is a stretch. Please keep it on topic.",
};

const REPLIES: readonly ChatbotReply[] = [
  UNKNOWN_REPLY,
  POLICY_REPLY,
  OFF_TOPIC_REPLY,
];

/**
 * Cycles through the three answers by turn so nobody has to guess which joke
 * they will get. The input text is deliberately ignored.
 */
const replyForTurn = (turn: number): ChatbotReply => {
  const normalized =
    ((turn % REPLIES.length) + REPLIES.length) % REPLIES.length;

  return REPLIES[normalized] ?? UNKNOWN_REPLY;
};

export { replyForTurn };

export type { ChatbotReply };
