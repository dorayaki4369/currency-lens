export function getTimestamp(date: Date): number {
  date.setMinutes(0, 0, 0);

  return date.getTime();
}
