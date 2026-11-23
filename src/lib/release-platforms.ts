/** Known modpack distribution targets. IDs are stored as extensible text. */
export const MODPACK_PLATFORMS = [
  { extensions: [".mrpack"], id: "modrinth", label: "Modrinth" },
  { extensions: [".zip"], id: "prism-launcher", label: "Prism Launcher" },
  { extensions: [".zip"], id: "curseforge", label: "CurseForge" },
] as const;

export const normalizePlatformId = (label: string): string =>
  label
    .normalize("NFKD")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-|-$/gu, "")
    .slice(0, 48);

export const isPlatformId = (value: string): boolean =>
  /^[a-z0-9][a-z0-9-]{0,47}$/u.test(value);

export const platformLabel = (id: string | null | undefined): string => {
  if (!id) {
    return "General download";
  }

  const known = MODPACK_PLATFORMS.find((platform) => platform.id === id);

  return (
    known?.label ??
    id.replaceAll("-", " ").replaceAll(/\b\w/gu, (c) => c.toUpperCase())
  );
};

/** Unknown platforms may use either supported modpack archive format. */
export const platformExtensions = (id: string): readonly string[] =>
  MODPACK_PLATFORMS.find((platform) => platform.id === id)?.extensions ?? [
    ".mrpack",
    ".zip",
  ];
