export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (seconds < 60) return "przed chwilą";
  if (minutes < 60) return `${minutes} min temu`;
  if (hours < 24) return `${hours} godz. temu`;
  if (days < 7) return `${days} ${days === 1 ? "dzień" : "dni"} temu`;
  return `${weeks} ${weeks === 1 ? "tydzień" : weeks < 5 ? "tygodnie" : "tygodni"} temu`;
}
