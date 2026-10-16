import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/404")({
  loader: () => {
    throw notFound();
  },
  component: () => null,
});
