import { DocumentIcon, PackageIcon } from "../Icons";
import { OrcidLogo } from "../OrcidLogo";
import { DublinCoreLogo } from "./DublinCoreLogo";
import { DSpaceLogo } from "./DSpaceLogo";
import { EPrintsLogo } from "./EPrintsLogo";
import { EXPORT_ZIP_DESTINATION } from "../../../utils/exportProfiles";

/**
 * Icono del destino de exportación (logos de repositorio o genérico).
 */
export function ExportProfileIcon({ profile, size = 20, className = "shrink-0" }) {
  switch (profile) {
    case "generic":
      return <OrcidLogo size={size} className={className} />;
    case "dublin_core":
      return <DublinCoreLogo size={size} className={className} />;
    case "dspace":
      return <DSpaceLogo size={size} className={className} />;
    case "eprints":
      return <EPrintsLogo size={15} className={className} />;
    case EXPORT_ZIP_DESTINATION:
      return <PackageIcon size={size} className={`text-ink-secondary ${className}`} />;
    default:
      return <DocumentIcon size={size} className={`text-ink-secondary ${className}`} />;
  }
}
