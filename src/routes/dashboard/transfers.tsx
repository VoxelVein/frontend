import { createFileRoute } from "@tanstack/react-router";

import { TransfersPage } from "@/components/dashboard/transfers-page";

export const Route = createFileRoute("/dashboard/transfers")({
  component: TransfersPage,
  head: () => ({
    meta: [{ title: "Project transfers | VoxelVein" }],
  }),
});
