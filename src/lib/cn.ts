/** Join conditional class names. Keeps className expressions readable. */
export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Joins metadata parts with a separator, dropping the ones that are absent.
 *
 * A product may have no pack size, a retailer no geography. Concatenating
 * those straight into a line prints "undefined" on the page, and padding them
 * with a placeholder invents a value. Leaving them out is the honest answer.
 */
export function meta(...parts: (string | number | null | undefined)[]): string {
  return parts.filter((p) => p !== null && p !== undefined && p !== "").join(" · ");
}
