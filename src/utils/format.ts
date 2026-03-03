export function partyLabel(count: number): string {
  if (count >= 4) return "Pełna drużyna";
  if (count === 3) return "4-man";
  if (count === 2) return "Trio";
  return "Duo";
}

export function getPostScoreColor(score: number): string {
  if (score >= 8.0) return "text-[#ffb928]";
  if (score >= 6.0) return "text-win";
  if (score >= 4.0) return "text-gold-primary";
  if (score >= 2.0) return "text-text-secondary";
  return "text-loss";
}
