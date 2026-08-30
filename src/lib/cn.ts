type ClassValue = string | number | null | undefined | false;

/** Join truthy class values. No variant/merge magic — keep it boring. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
