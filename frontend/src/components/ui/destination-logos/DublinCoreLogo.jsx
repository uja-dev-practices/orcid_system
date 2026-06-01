/**
 * Logotipo DCMI Dublin Core: círculo central y anillos de puntos sobre fondo naranja.
 * Réplica del icono oficial (sunburst).
 */

const ORANGE = "#FF6600";
const CENTER = 50;
const INNER = { count: 12, radius: 22, dotR: 4.8 };
const OUTER = { count: 16, radius: 36, dotR: 3.6 };
const CORE_R = 11.5;

function ringDots({ count, radius, dotR }) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    return {
      key: `${radius}-${i}`,
      cx: CENTER + radius * Math.cos(angle),
      cy: CENTER + radius * Math.sin(angle),
      r: dotR,
    };
  });
}

export function DublinCoreLogo({ size = 20, className = "" }) {
  const innerDots = ringDots(INNER);
  const outerDots = ringDots(OUTER);

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Dublin Core"
    >
      <rect width="100" height="100" fill={ORANGE} />
      <circle cx={CENTER} cy={CENTER} r={CORE_R} fill="#fff" />
      {innerDots.map(({ key, cx, cy, r }) => (
        <circle key={key} cx={cx} cy={cy} r={r} fill="#fff" />
      ))}
      {outerDots.map(({ key, cx, cy, r }) => (
        <circle key={key} cx={cx} cy={cy} r={r} fill="#fff" />
      ))}
    </svg>
  );
}
