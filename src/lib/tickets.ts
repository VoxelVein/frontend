import {
  array,
  maxLength,
  minLength,
  object,
  optional,
  pipe,
  string,
  uuid,
} from "valibot";

export const TICKET_STATUS_VALUES = ["open", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUS_VALUES)[number];

export const TICKET_SUBJECT_MAX_LENGTH = 120;
export const TICKET_MESSAGE_MAX_LENGTH = 2000;

/** Subject supplied when opening a ticket. */
export const ticketOpenSchema = object({
  message: pipe(
    string(),
    minLength(1, "Write a message."),
    maxLength(TICKET_MESSAGE_MAX_LENGTH)
  ),
  subject: pipe(
    string(),
    minLength(3, "Subject must be at least 3 characters."),
    maxLength(TICKET_SUBJECT_MAX_LENGTH)
  ),
  tags: optional(
    array(
      pipe(
        string(),
        minLength(1, "Tag must not be empty."),
        maxLength(24, "Tag must be at most 24 characters.")
      )
    )
  ),
});

export const ticketTagsSchema = object({
  tags: array(
    pipe(
      string(),
      minLength(1, "Tag must not be empty."),
      maxLength(24, "Tag must be at most 24 characters.")
    )
  ),
  ticketId: pipe(string(), uuid()),
});

/** A reply added to an existing ticket. */
export const ticketReplySchema = object({
  body: pipe(
    string(),
    minLength(1, "Write a message."),
    maxLength(TICKET_MESSAGE_MAX_LENGTH)
  ),
  ticketId: pipe(string(), uuid()),
});

export const toTicketStatus = (value: string): TicketStatus =>
  value === "closed" ? "closed" : "open";
