import { IconArrowUpRight, IconSpeakerphone } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";

import { Reveal } from "@/components/reveal";
import { cn } from "@/lib/utils";

type NewsCategory = "Announcement" | "Community" | "Development";

interface NewsItem {
  category: NewsCategory;
  title: string;
  excerpt: string;
  date: string;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

const NEWS: NewsItem[] = [
  {
    category: "Announcement",
    date: "2026-08-28",
    excerpt:
      "A major update brings redesigned project pages, faster search, and a brand-new launcher integration.",
    title: "VoxelVein 2.0 is here",
  },
  {
    category: "Community",
    date: "2026-08-14",
    excerpt:
      "Check out the incredible mods created during our month-long community mod jam — over 200 entries!",
    title: "Community Mod Jam winners announced",
  },
  {
    category: "Development",
    date: "2026-07-30",
    excerpt:
      "A comprehensive guide for shader developers, covering the new pipeline and best practices.",
    title: "New shader API documentation",
  },
];

const CATEGORY_COLORS = {
  Announcement: "bg-primary/10 text-primary border-primary/20",
  Community: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  Development: "bg-chart-2/10 text-chart-2 border-chart-2/20",
} satisfies Record<NewsCategory, string>;

const NewsSection = () => (
  <section
    id="news"
    aria-labelledby="news-heading"
    className="px-4 py-16 sm:px-6 lg:px-8"
  >
    <div className="mx-auto max-w-7xl">
      <Reveal className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h2
            id="news-heading"
            className="text-2xl font-bold tracking-tight sm:text-3xl"
          >
            News
          </h2>
          <p className="text-muted-foreground mt-2">
            Updates from the VoxelVein team and community.
          </p>
        </div>
        <Link
          to="/blog"
          preload="intent"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring ease-smooth inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
        >
          View all
          <IconArrowUpRight size={16} />
        </Link>
      </Reveal>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {NEWS.map((item, index) => (
          <Reveal key={item.title} delay={index * 0.06}>
            <article className="group border-border bg-card ease-smooth relative h-full rounded-xl border p-6 transition-transform duration-300 hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none">
              <Link
                to="/blog"
                preload="intent"
                className="focus-visible:ring-ring absolute inset-0 rounded-xl focus-visible:ring-2 focus-visible:outline-none"
                aria-label={`Read: ${item.title}`}
              >
                <span className="sr-only">Read: {item.title}</span>
              </Link>

              <div
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                  CATEGORY_COLORS[item.category]
                )}
              >
                <IconSpeakerphone size={12} aria-hidden="true" />
                {item.category}
              </div>

              <h3 className="mt-3 mb-2 font-semibold">{item.title}</h3>
              <p className="text-muted-foreground mb-4 line-clamp-3 text-sm">
                {item.excerpt}
              </p>

              <time
                dateTime={item.date}
                className="text-muted-foreground text-xs"
              >
                {dateFormatter.format(new Date(item.date))}
              </time>
            </article>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

export { NewsSection };
