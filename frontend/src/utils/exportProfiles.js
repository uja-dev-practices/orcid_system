/** Perfiles de exportación SWORD XML (query `profile` en el backend). */
export const EXPORT_PROFILE_OPTIONS = [
  { value: "generic", label: "Genérico (ORCID)" },
  { value: "dublin_core", label: "Dublin Core" },
  { value: "dspace", label: "DSpace" },
  { value: "eprints", label: "EPrints" },
];

export const DEFAULT_EXPORT_PROFILE = "generic";

export function swordXmlFilename(baseName, profile = DEFAULT_EXPORT_PROFILE) {
  const suffix =
    profile && profile !== DEFAULT_EXPORT_PROFILE ? `-${profile}` : "";
  return `sword${suffix}-${baseName}.xml`;
}
