export function parseSqliteDatetime(value?: string | null): Date | null {
  if (!value) return null
  const iso = value.includes("T") ? value : `${value.replace(" ", "T")}Z`
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatSqliteDatetime(
  value?: string | null,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = parseSqliteDatetime(value)
  if (!date) return "—"
  return date.toLocaleString(undefined, options)
}
