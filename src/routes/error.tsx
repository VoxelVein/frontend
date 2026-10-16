import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/error")({
  loader: () => {
    throw new Error("This is only here to show off the error boundary.");
  },
  component: () => null,
});
