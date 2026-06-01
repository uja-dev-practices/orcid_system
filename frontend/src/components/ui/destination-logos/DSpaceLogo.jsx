import { DSPACE_LOGO_PATH, DSPACE_VIEWBOX } from "./dspace-path";

/** Logotipo oficial DSpace (#92C642). */
export function DSpaceLogo({ size = 20, className = "" }) {
  return (
    <svg
      viewBox={DSPACE_VIEWBOX}
      width={size}
      height={size}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="DSpace"
    >
      <path fill="#92C642" d={DSPACE_LOGO_PATH} />
    </svg>
  );
}
