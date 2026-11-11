/** @typedef {{ date: string, price: number }} TefasHistoryPoint */

/** @param {unknown} value */
function positivePrice(value) {
  const price = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(price) && price > 0 ? price : null;
}

/** @param {unknown} rows @returns {TefasHistoryPoint[]} */
export function parseTefasHistory(rows) {
  if (!Array.isArray(rows)) return [];

  const points = [];
  for (const row of rows) {
    const date = row?.tarih;
    const price = positivePrice(row?.fiyat);
    if (price === null || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const parsed = new Date(`${date}T00:00:00Z`);
    if (Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date) {
      points.push({ date, price });
    }
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * @param {unknown} summaryPrice
 * @param {TefasHistoryPoint | undefined} latest
 */
export function getTefasQuote(summaryPrice, latest) {
  const price = positivePrice(summaryPrice);
  if (price === null) return latest ? { price: latest.price, navDate: latest.date } : null;

  // TEFAS's summary has no date. Use the latest history date only if its price matches.
  return { price, navDate: latest?.price === price ? latest.date : null };
}
