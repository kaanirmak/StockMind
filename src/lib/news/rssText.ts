/** RSS descriptions often contain HTML escaped inside XML, sometimes twice. */
export function rssPlainText(value: string): string {
  let text = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  for (let pass = 0; pass < 2; pass++) {
    text = text.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|quot|apos|nbsp|amp);/gi, (entity, code: string) => {
      if (code.startsWith('#')) {
        const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : '';
      }
      return ({ lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', amp: '&' } as Record<string, string>)[code.toLowerCase()] || entity;
    });
  }
  return text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
