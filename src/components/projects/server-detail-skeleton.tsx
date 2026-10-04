import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder shown while a server's loader runs.
 *
 * Mirrors `ServerDetail`'s two-column shape so the page does not reflow when
 * the real content lands: the sidebar is a narrow column of cards, the main
 * column a block of prose. A single full-width skeleton would collapse into a
 * stack and then jump back out.
 */
const ServerDetailSkeleton = () => (
  <div
    aria-busy="true"
    className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8"
  >
    <Skeleton className="h-11 w-36" />

    <div className="mt-4 flex gap-4 sm:gap-5">
      <Skeleton className="size-16 rounded-2xl sm:size-20" />
      <div className="flex-1">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-3 h-9 w-64 max-w-full" />
      </div>
    </div>

    <Skeleton className="mt-6 h-5 w-full max-w-xl" />

    <div className="mt-10 grid gap-10 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-12">
      <div className="grid gap-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
      <div>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-4 h-40 w-full rounded-xl" />
        <Skeleton className="mt-4 h-40 w-full rounded-xl" />
      </div>
    </div>
  </div>
);

export { ServerDetailSkeleton };
