export const parseDate = (dateStr: string | null): Date | null => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
};

export const serializeDate = (date: Date | string | null): string | null => {
  if (!date) return null;
  if (typeof date === 'string') return date;
  return date.toISOString();
};