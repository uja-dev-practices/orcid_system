/**
 * Logotipo EPrints (vectorizado en `public/eprints-logo.svg`).
 */
const EPRINTS_LOGO_SRC = `${import.meta.env.BASE_URL}eprints-logo.svg`;

export function EPrintsLogo({ size = 20, className = "" }) {
  return (
    <img
      src={EPRINTS_LOGO_SRC}
      width={size}
      height={size}
      className={className}
      alt=""
      aria-label="EPrints"
      decoding="async"
      draggable={false}
    />
  );
}
