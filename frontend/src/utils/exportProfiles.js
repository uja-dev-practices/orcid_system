/** Perfiles de exportación SWORD XML (query `profile` en el backend). */
export const EXPORT_PROFILE_OPTIONS = [
  {
    value: "generic",
    label: "Genérico (ORCID)",
    desc: "Metadatos ORCID en SWORD XML",
  },
  {
    value: "dublin_core",
    label: "Dublin Core",
    desc: "Esquema Dublin Core",
  },
  {
    value: "dspace",
    label: "DSpace",
    desc: "Compatible con repositorio DSpace",
  },
  {
    value: "eprints",
    label: "EPrints",
    desc: "Compatible con repositorio EPrints",
  },
];

export const EXPORT_ZIP_DESTINATION = "zip";

export const ZIP_DESTINATION_OPTION = {
  value: EXPORT_ZIP_DESTINATION,
  label: "Paquete ZIP",
  desc: "Todos los formatos en un único paquete",
};

export const DEFAULT_EXPORT_PROFILE = "generic";
export const DEFAULT_EXPORT_DESTINATION = DEFAULT_EXPORT_PROFILE;

/** Convierte el valor del selector de destino en formato + perfil SWORD. */
export function resolveExportFromDestination(destination) {
  if (destination === EXPORT_ZIP_DESTINATION) {
    return { format: "zip", profile: undefined };
  }
  return { format: "xml", profile: destination };
}

export function swordXmlFilename(baseName, profile = DEFAULT_EXPORT_PROFILE) {
  const suffix =
    profile && profile !== DEFAULT_EXPORT_PROFILE ? `-${profile}` : "";
  return `sword${suffix}-${baseName}.xml`;
}
