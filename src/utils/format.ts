export function partyLabel(count: number): string {
  if (count >= 4) return "Pełna drużyna";
  if (count === 3) return "4-man";
  if (count === 2) return "Trio";
  return "Duo";
}
