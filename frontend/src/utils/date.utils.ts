import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns'

export function formatDate(dateStr: string, fmt = 'MMM d, yyyy'): string {
  try {
    const d = parseISO(dateStr)
    return isValid(d) ? format(d, fmt) : dateStr
  } catch {
    return dateStr
  }
}

export function formatRelative(dateStr: string): string {
  try {
    const d = parseISO(dateStr)
    return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : dateStr
  } catch {
    return dateStr
  }
}

export function formatDateTime(dateStr: string): string {
  return formatDate(dateStr, 'MMM d, yyyy HH:mm')
}
