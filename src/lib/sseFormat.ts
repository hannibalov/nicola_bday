/** One Server-Sent Event data frame (event name optional). */

export function formatSseData(data: unknown): string {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  return `data: ${payload}\n\n`;
}
