/**
 * База URL б для картинок /uploads. SAME_ORIGIN — фронт и API за одним хостом (nginx + туннель).
 */
export function getPublicApiBase(): string {
  const v = process.env.NEXT_PUBLIC_API_URL;
  if (v === 'SAME_ORIGIN') return '';
  if (v) return v;
  return 'http://localhost:8000';
}
