import {
  createFileRoute,
  redirect,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { object, optional, parse, picklist } from "valibot";

import { AdminPosts } from "@/components/admin/admin-posts";
import { AdminSessions } from "@/components/admin/admin-sessions";
import { AdminStorage } from "@/components/admin/admin-storage";
import { AdminUsers } from "@/components/admin/admin-users";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireAdmin } from "@/lib/auth.functions";

const adminSearchSchema = object({
  tab: optional(picklist(["posts", "sessions", "storage", "users"])),
});

const AdminPage = () => {
  const navigate = useNavigate();
  const { tab = "users" } = useSearch({ from: "/admin" });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
      <PageHeader
        title="Admin Panel"
        description="Manage users, sessions, blog posts, and file storage."
      />

      <Tabs
        value={tab}
        onValueChange={(value) =>
          navigate({
            to: "/admin",
            search: { tab: value },
            replace: true,
          })
        }
        className="mt-8"
      >
        <TabsList aria-label="Admin sections">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <AdminUsers />
        </TabsContent>

        <TabsContent value="sessions">
          <AdminSessions />
        </TabsContent>

        <TabsContent value="posts">
          <AdminPosts />
        </TabsContent>

        <TabsContent value="storage">
          <AdminStorage />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, string | undefined>) =>
    parse(adminSearchSchema, search),
  beforeLoad: async () => {
    const session = await requireAdmin();
    if (!session) {
      throw redirect({ to: "/login" });
    }
    return { session };
  },
  component: AdminPage,
});
