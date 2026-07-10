export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
export function addMonthsISO(baseISO: string, months: number): string {
  const d = new Date(baseISO + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}
