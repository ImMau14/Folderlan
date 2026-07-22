export function formatBytes(bytes: number, decimals = 2): string {
  if (!bytes || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)
  return `${parseFloat(value.toFixed(decimals))} ${units[i]}`
}

export default formatBytes
