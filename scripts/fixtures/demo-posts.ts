/** Development seed data for the blog. Not real announcements. */
export interface DemoPost {
  content: string;
  /** Set explicitly so the teaser does not have to be derived from the body. */
  excerpt: string;
  slug: string;
  title: string;
  /**
   * Days before now, so seeded posts land in a believable recent order however
   * old the development database is.
   */
  daysAgo: number;
}

export const DEMO_POSTS: DemoPost[] = [
  {
    content: `## Sodium 0.6.12

The rendering rewrite is done. Frame times are now flat across the whole
render distance instead of spiking whenever a new chunk enters the frustum.

### What changed

- Chunk meshing moved onto a background thread, so building terrain no longer
  blocks the main loop.
- The fog distance now follows your render distance setting rather than a fixed
  constant.
- Memory use during a full world load dropped by roughly 30%.

### Upgrading

Drop the old \`sodium\` folder in and put the new one in its place. There is no
configuration to carry over; the new options file is written on first launch.`,
    excerpt:
      "The rendering rewrite is done: flat frame times, background meshing, and about 30% less memory on a full world load.",
    daysAgo: 2,
    slug: "sodium-0-6-12",
    title: "Sodium 0.6.12 is out",
  },
  {
    content: `## Search now runs on our own database

Site search used to run through a separate service. That is gone. Queries now
run as SQL against the same Postgres database that already holds every project
and post.

### Why

One fewer service to run, one fewer thing that can be temporarily unavailable,
and no reindex step after a deploy. Typo tolerance comes from trigram indexes,
which means a mistyped search still finds the project you meant.`,
    excerpt:
      "Search moved off a separate service and into our own database, with trigram indexes so typos still find what you meant.",
    daysAgo: 9,
    slug: "search-now-runs-on-our-own-database",
    title: "Search now runs on our own database",
  },
  {
    content: `## Uploading a project, step by step

A walkthrough of what happens after you drop a \`.jar\` into the upload form,
and what each status on your dashboard means.

### The statuses

- **Draft**: only you can see it.
- **In review**: we are looking at it.
- **Published**: anyone can find, install and download it.

### What we look at

We check that the file is a real mod, that it declares the Minecraft version it
targets, and that the description says what the project does. If something is
wrong we send it back with a reason rather than silently rejecting it.`,
    excerpt:
      "What happens after you upload a jar, what each dashboard status means, and what we check before publishing.",
    daysAgo: 21,
    slug: "uploading-a-project-step-by-step",
    title: "Uploading a project, step by step",
  },
];
