export function isNotNullObj (obj) {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj)
}
