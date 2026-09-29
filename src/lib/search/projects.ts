import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  array,
  nullish,
  number,
  object,
  picklist,
  record,
  safeParse,
  string,
} from "valibot";
import type { InferOutput } from "valibot";

import { db } from "@/db";
import type {
  ProjectSearchParams,
  ProjectSearchResponse,
} from "@/lib/project-search.functions";
import type { ProjectDocument } from "@/lib/projects";
import { CLIENT_REQUIREMENTS, PROJECT_TYPES } from "@/lib/projects";
import { matchProject, rankProject, toTextQuery } from "@/lib/search/text";

const DEFAULT_SORT = "downloads:desc";
const PAGE_SIZE = 12;
const MAX_PAGE = 1000;

const SORT_SQL = {
  "downloads:desc": sql`matched.downloads desc`,
  "name:asc": sql`matched.name asc`,
  "updatedAt:desc": sql`matched."updatedAt" desc`,
} as const satisfies Record<string, SQL>;

const FALLBACK_AUTHOR = "Unknown creator";

/**
 * Aggregates every version's Minecraft versions and loaders per project.
 *
 * These live on `project_versions`, not `projects`, so a project-level view has
 * to union across versions.
 *
 * The shape is expand-dedupe-aggregate rather than two scalar subqueries over
 * `unnest(game_versions)`. Postgres rejects the latter outright — a subquery in
 * the select list cannot reference an outer column that the `GROUP BY` does not
 * cover, so it fails at plan time with `subquery uses ungrouped column`. The
 * inner `select distinct` flattens each version's version/loader cross product
 * to one row per combination, and the outer aggregate takes the union. The
 * cross product is harmless because only the union of values is ever wanted,
 * not the pairing.
 *
 * A project with no published versions produces no rows here, which is why the
 * caller left-joins and why `gameVersions` and `loaders` are nullable in a hit.
 */
/**
 * What a server's players need on their client, from its published links:
 * `required` if any link is required, `recommended` if there are only
 * optional links, `vanilla` with none. Must match `clientRequirementFor` in
 * `@/lib/projects`. Null for every other project type.
 */
const clientRequirementSQL = sql`
  case
    when projects.type <> 'server' then null
    when exists (
      select 1
      from project_server_links links
      join projects linked on linked.id = links.linked_project_id
      where links.server_id = projects.id
        and links.required
        and linked.status = 'published'
        and linked.pending_deletion = false
    ) then 'required'
    when exists (
      select 1
      from project_server_links links
      join projects linked on linked.id = links.linked_project_id
      where links.server_id = projects.id
        and linked.status = 'published'
        and linked.pending_deletion = false
    ) then 'recommended'
    else 'vanilla'
  end
`;

const versionFacets = sql`
  select
    "projectId",
    coalesce(array_agg(distinct "gameVersion"), '{}'::text[]) as "gameVersions",
    coalesce(array_agg(distinct "loader"), '{}'::text[]) as loaders
  from (
    select distinct
      project_id as "projectId",
      game_version as "gameVersion",
      loader as "loader"
    from project_versions
    cross join lateral unnest(game_versions) as game_version
    cross join lateral unnest(loaders) as loader
  ) expanded
  group by "projectId"
`;

/** The rows a query matches, before ranking, ordering or paging. */
const matchedProjects = (params: ProjectSearchParams, q: string) => {
  const textQuery = toTextQuery(q);
  const isSearching = q.length > 0;

  return sql`
    with version_facets as (${versionFacets}),
    matched as (
      select
        projects.category,
        projects.downloads,
        projects.id,
        projects.name,
        projects.slug,
        projects.summary as description,
        projects.tags,
        projects.type,
        projects.updated_at as "updatedAt",
        -- Servers have no versions; their supported versions live on the
        -- listing instead.
        coalesce(
          project_servers.game_versions,
          version_facets."gameVersions"
        ) as "gameVersions",
        version_facets.loaders,
        ${clientRequirementSQL} as "clientRequirement",
        coalesce(
          users.display_username,
          users.username,
          users.name,
          ${FALLBACK_AUTHOR}
        ) as author,
        -- Left as null rather than coalesced: a null here is what tells the UI
        -- not to link a byline at all, which is correct when the account is
        -- gone. Coalescing would produce a link to a profile that 404s.
        users.username as "authorUsername",
        -- Coalesced, not null: a project with no versions yet is still
        -- browsable, and buildProjectDocument shaped the document this
        -- replaced the same way, so the hit type stays a plain string.
        coalesce(
          (
            select project_versions.version_number
            from project_versions
            where project_versions.project_id = projects.id
            order by project_versions.created_at desc
            limit 1
          ),
          ''
        ) as version,
        ${isSearching ? sql`${rankProject(q, textQuery)}` : sql`0`} as rank
      from projects
      -- Left join: a kept project whose owner deleted their account has none.
      left join users on users.id = projects.owner_id
      left join version_facets on version_facets."projectId" = projects.id
      left join project_servers on project_servers.project_id = projects.id
      where projects.status = 'published'
        and projects.pending_deletion = false
        and projects.type = ${params.type}
        and (
          ${params.category ?? null}::text is null
          or projects.category = ${params.category ?? null}
        )
        and (
          ${params.gameVersion ?? null}::text is null
          or ${params.gameVersion ?? null} = any(
            coalesce(project_servers.game_versions, version_facets."gameVersions")
          )
        )
        and (
          ${params.loader ?? null}::text is null
          or ${params.loader ?? null} = any(version_facets.loaders)
        )
        and (
          ${params.clientRequirement ?? null}::text is null
          or ${clientRequirementSQL} = ${params.clientRequirement ?? null}
        )
        ${isSearching ? sql`and ${matchProject(q, textQuery)}` : sql``}
    )
  `;
};

const countFacets = (column: SQL) => sql`
  select coalesce(jsonb_object_agg(facet, total), '{}'::jsonb)
  from (
    select ${column} as facet, count(*)::int as total
    from matched
    where ${column} is not null
    group by facet
  ) counts
`;

const unnestFacet = (column: SQL) => sql`
  select coalesce(jsonb_object_agg(facet, total), '{}'::jsonb)
  from (
    select value as facet, count(*)::int as total
    from matched, unnest(${column}) as value
    group by value
  ) counts
`;

const facetCountsSchema = record(string(), record(string(), number()));

/**
 * One hit as `to_jsonb` renders it.
 *
 * `gameVersions` and `loaders` are nullable because a project with no published
 * versions left-joins to no `version_facets` row at all.
 */
const projectHitSchema = object({
  author: string(),
  authorUsername: nullish(string()),
  category: string(),
  clientRequirement: nullish(picklist(CLIENT_REQUIREMENTS)),
  description: string(),
  downloads: number(),
  gameVersions: nullish(array(string())),
  id: string(),
  loaders: nullish(array(string())),
  name: string(),
  slug: string(),
  tags: array(string()),
  type: picklist(PROJECT_TYPES),
  updatedAt: string(),
  version: string(),
});

type ProjectHit = InferOutput<typeof projectHitSchema>;

const projectSearchRowSchema = object({
  estimatedTotalHits: number(),
  facetDistribution: nullish(facetCountsSchema),
  hits: array(projectHitSchema),
});

/**
 * Normalises a validated hit into a `ProjectDocument`.
 *
 * `updatedAt` is re-serialised rather than passed through: `to_jsonb` renders a
 * `timestamp` without a zone or milliseconds, which would then parse as local
 * time and render the wrong day.
 */
const toDocument = ({
  clientRequirement,
  ...hit
}: ProjectHit): ProjectDocument => {
  const document: ProjectDocument = {
    ...hit,
    authorUsername: hit.authorUsername ?? null,
    // Search rows are built by Postgres and do not carry images, so a hit
    // renders the letter avatar. The full document, which does include them,
    // backs the project and profile pages.
    gallery: [],
    gameVersions: hit.gameVersions ?? [],
    icon: null,
    loaders: hit.loaders ?? [],
    updatedAt: new Date(hit.updatedAt).toISOString(),
  };
  // Only servers have one; other hits leave the key out entirely.
  if (clientRequirement) {
    document.clientRequirement = clientRequirement;
  }
  return document;
};

/**
 * Runs a project search against Postgres.
 *
 * Everything the UI needs — hits, total count and all three facet
 * distributions — comes back in a single round trip, because a second query for
 * the facet counts would have to repeat the whole `matched` set.
 */
export const searchProjectsInDatabase = async (
  params: ProjectSearchParams
): Promise<ProjectSearchResponse> => {
  const q = params.query.trim();
  const page = Math.min(Math.max(1, params.page ?? 1), MAX_PAGE);
  const offset = (page - 1) * PAGE_SIZE;
  // SAFETY: SORT_SQL is keyed by the same allowlist the caller validated the
  // sort against, so an unknown value cannot reach this lookup.
  const sortSQL =
    SORT_SQL[params.sort as keyof typeof SORT_SQL] ?? SORT_SQL[DEFAULT_SORT];
  // Relevance leads only when the visitor actually typed something. With an
  // empty box the list is a browse view, and the chosen sort is the point.
  const orderSQL =
    q.length > 0
      ? sql`matched.rank desc, ${sortSQL}, matched.id asc`
      : sql`${sortSQL}, matched.id asc`;

  const result = await db.execute(sql`
    ${matchedProjects(params, q)},
    hits as (
      select * from matched order by ${orderSQL} limit ${PAGE_SIZE} offset ${offset}
    ),
    facet_category as (${countFacets(sql`matched.category`)}),
    facet_game_versions as (${unnestFacet(sql`matched."gameVersions"`)}),
    facet_loaders as (${unnestFacet(sql`matched.loaders`)})
    select
      (select count(*)::int from matched) as "estimatedTotalHits",
      coalesce((select jsonb_agg(to_jsonb(hits)) from hits), '[]'::jsonb) as hits,
      jsonb_build_object(
        'category', (select * from facet_category),
        'gameVersions', (select * from facet_game_versions),
        'loaders', (select * from facet_loaders)
      ) as "facetDistribution"
  `);

  const [row] = result.rows;
  const parsed = safeParse(projectSearchRowSchema, row);

  // The query is hand-written SQL, so a schema mismatch here is a bug rather
  // than bad user input. Throwing would turn a search failure into a 500 and an
  // error boundary, so an unreadable result set degrades to "no matches" and the
  // browse view still renders.
  if (!parsed.success) {
    return {
      estimatedTotalHits: 0,
      facetDistribution: null,
      hits: [],
      page,
      pageSize: PAGE_SIZE,
      query: q,
    };
  }

  const { estimatedTotalHits, facetDistribution, hits } = parsed.output;

  return {
    estimatedTotalHits,
    facetDistribution: facetDistribution ?? null,
    hits: hits.map(toDocument),
    page,
    pageSize: PAGE_SIZE,
    query: q,
  };
};
