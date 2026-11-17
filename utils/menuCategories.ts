/**
 * Normalizes menu item categories from either an array (`categories`), JSON string,
 * or comma-separated `category` string, deduplicating case-insensitively while preserving order.
 */
export function normalizeItemCategories(
  categories: unknown,
  fallbackCategory?: unknown,
  defaultValue: string[] = ['General']
): string[] {
  const parseRaw = (raw: unknown): string[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw.map((entry) => String(entry ?? '').trim()).filter(Boolean);
    }
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) return [];
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            return parsed.map((entry) => String(entry ?? '').trim()).filter(Boolean);
          }
        } catch {
          // Fall back to comma splitting
        }
      }
      return trimmed
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
    return [String(raw).trim()].filter(Boolean);
  };

  const primary = parseRaw(categories);
  const source = primary.length > 0 ? primary : parseRaw(fallbackCategory);

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const label of source) {
    const slug = label.toLowerCase();
    if (seen.has(slug)) continue;
    seen.add(slug);
    deduped.push(label);
  }

  return deduped.length > 0 ? deduped : [...defaultValue];
}
