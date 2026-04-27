/**
 * Publication type catalogue — labels + Tailwind class sets per variant.
 * Keeping Tailwind classes (instead of inline styles) here lets the Badge
 * component stay declarative while still covering every ORCID work-type.
 */
export const TYPE_LABELS = {
  "journal-article": "Artículo",
  review: "Revisión",
  "conference-paper": "Conferencia",
  "book-chapter": "Cap. Libro",
  dataset: "Dataset",
};

export const TYPE_BADGE_CLASSES = {
  "journal-article":
    "bg-tag-article-bg text-tag-article-text border border-tag-article-border",
  review:
    "bg-tag-review-bg text-tag-review-text border border-tag-review-border",
  "conference-paper":
    "bg-tag-conference-bg text-tag-conference-text border border-tag-conference-border",
  "book-chapter":
    "bg-tag-book-bg text-tag-book-text border border-tag-book-border",
  dataset:
    "bg-tag-dataset-bg text-tag-dataset-text border border-tag-dataset-border",
};

export const DEFAULT_BADGE_CLASSES =
  "bg-tag-default-bg text-tag-default-text border border-tag-default-border";
