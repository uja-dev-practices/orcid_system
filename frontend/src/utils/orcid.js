/**
 * ORCID iD regex (16 digits, hyphen every 4, last char may be 'X' checksum).
 * @see https://support.orcid.org/hc/en-us/articles/360006897674
 */
export const ORCID_REGEX = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

/**
 * Auto-formats a raw user input into the canonical ORCID layout
 * `0000-0000-0000-000X`, keeping digits + final 'X' only.
 */
export function formatOrcidInput(raw) {
  const digits = raw.replace(/[^0-9X]/gi, "").toUpperCase();
  const parts = [];
  for (let i = 0; i < digits.length && i < 16; i += 4) {
    parts.push(digits.slice(i, i + 4));
  }
  return parts.join("-");
}

export function isValidOrcid(value) {
  return ORCID_REGEX.test(value);
}
