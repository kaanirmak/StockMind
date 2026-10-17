'use client';

import React, { useState, useId } from 'react';

interface ChatMessageContentProps {
  content: string;
  isUser?: boolean;
}

/**
 * Parses inline markdown:
 * - **bold text** -> <strong>
 * - `code text` -> <code>
 * - *italic text* -> <em>
 * - [anchor](url) -> <a>
 */
function renderInline(text: string, isUser = false): React.ReactNode[] {
  if (!text) return [];

  const parts: React.ReactNode[] = [];
  // Match bold (**...**), inline code (`...`), links ([...](...)), and italic (*...*)
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];

    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      const boldText = token.slice(2, -2);
      parts.push(
        <strong
          key={match.index}
          className={`font-bold ${isUser ? 'text-white' : 'text-text-primary'}`}
        >
          {boldText}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      const codeText = token.slice(1, -1);
      parts.push(
        <code
          key={match.index}
          className={`px-1.5 py-0.5 rounded text-[11px] font-mono ${
            isUser
              ? 'bg-white/20 text-white'
              : 'bg-bg-secondary text-accent border border-border/60'
          }`}
        >
          {codeText}
        </code>
      );
    } else if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
      const linkMatch = token.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        parts.push(
          <a
            key={match.index}
            href={/^(https?:\/\/|\/(?!\/))/.test(linkMatch[2]) ? linkMatch[2] : undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline font-medium hover:opacity-80 transition-opacity ${
              isUser ? 'text-white' : 'text-accent'
            }`}
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        parts.push(token);
      }
    } else if (token.startsWith('*') && token.endsWith('*') && token.length >= 2) {
      const italicText = token.slice(1, -1);
      parts.push(
        <em
          key={match.index}
          className={`italic ${isUser ? 'text-white/90' : 'text-text-secondary'}`}
        >
          {italicText}
        </em>
      );
    } else {
      parts.push(token);
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/**
 * Rich formatted Markdown message renderer for StockMind AI Assistant.
 * Handles headings, bold/italic, bullet lists, numbered lists, dividers, and callouts
 * with zero external dependencies and elegant typography.
 */
export function ChatMessageContent({ content, isUser = false }: ChatMessageContentProps) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  if (!content) return null;
  const collapsible = !isUser && content.length > 1800;

  const rawLines = content.split('\n');
  const blocks: React.ReactNode[] = [];

  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;

  const flushList = (key: string | number) => {
    if (!currentList) return;

    if (currentList.type === 'ul') {
      blocks.push(
        <ul key={`ul-${key}`} className="space-y-1.5 my-2">
          {currentList.items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm">
              <span
                className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${
                  isUser ? 'bg-white' : 'bg-accent'
                }`}
              />
              <span className="flex-1 leading-relaxed">
                {renderInline(item, isUser)}
              </span>
            </li>
          ))}
        </ul>
      );
    } else {
      blocks.push(
        <ol key={`ol-${key}`} className="space-y-1.5 my-2">
          {currentList.items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm">
              <span
                className={`font-bold font-mono text-[11px] mt-0.5 shrink-0 ${
                  isUser ? 'text-white' : 'text-accent'
                }`}
              >
                {idx + 1}.
              </span>
              <span className="flex-1 leading-relaxed">
                {renderInline(item, isUser)}
              </span>
            </li>
          ))}
        </ol>
      );
    }

    currentList = null;
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // 0. Fenced code block (```lang ... ```)
    if (trimmed.startsWith('```')) {
      flushList(i);
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < rawLines.length && !rawLines[i].trim().startsWith('```')) {
        codeLines.push(rawLines[i]);
        i++;
      }
      blocks.push(
        <div key={`code-${i}`} className="my-2.5 rounded-xl overflow-hidden border border-border/80 bg-bg-tertiary">
          {lang && (
            <div className="px-3 py-1 bg-bg-secondary text-[10px] font-mono font-semibold text-text-muted border-b border-border/60">
              {lang}
            </div>
          )}
          <pre className="p-3 text-xs font-mono text-text-primary overflow-x-auto whitespace-pre">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      continue;
    }

    // Markdown tables become accessible, horizontally scrollable data views.
    if (trimmed.includes('|') && i + 1 < rawLines.length && /^\s*\|?\s*:?-{3,}/.test(rawLines[i + 1])) {
      flushList(i);
      const cells = (row: string) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((v) => v.trim());
      const headers = cells(trimmed);
      const rows: string[][] = [];
      i += 2;
      while (i < rawLines.length && rawLines[i].includes('|')) { rows.push(cells(rawLines[i])); i++; }
      i--;
      blocks.push(<div key={`table-${i}`} className="overflow-x-auto my-3 rounded-xl border border-border"><table className="w-full text-xs text-left"><caption className="sr-only">Analiz verileri</caption><thead className="bg-bg-tertiary"><tr>{headers.map((v, n) => <th key={n} scope="col" className="p-3 font-semibold">{renderInline(v, isUser)}</th>)}</tr></thead><tbody>{rows.map((row, n) => <tr key={n} className="border-t border-border">{headers.map((_, c) => <td key={c} className="p-3 tabular-nums">{renderInline(row[c] || '', isUser)}</td>)}</tr>)}</tbody></table></div>);
      const percentageColumn = headers.findIndex((header) => /%|ağırlık|dağılım|yüzde/i.test(header));
      if (percentageColumn > 0 && rows.length > 1) {
        const series = rows.map((row) => ({ label: row[0], value: row[percentageColumn]?.trim() ? Number(row[percentageColumn].replace(/[%*\s]/g, '').replace(',', '.')) : NaN }));
        if (series.every((point) => point.label && Number.isFinite(point.value) && point.value >= 0 && point.value <= 100)) {
          blocks.push(<figure key={`chart-${i}`} className="p-3 rounded-xl bg-bg-tertiary space-y-2" aria-label={`${headers[percentageColumn]} karşılaştırması`}><figcaption className="text-xs font-semibold text-text-primary">{headers[percentageColumn]}</figcaption>{series.slice(0, 12).map((point, index) => <div key={index} className="grid grid-cols-[5rem_1fr_3rem] items-center gap-2 text-xs"><span className="truncate">{point.label}</span><span className="h-2 rounded-full bg-bg-card overflow-hidden"><span className="block h-full bg-accent rounded-full" style={{ width: `${point.value}%` }} /></span><span className="text-right tabular-nums">%{point.value.toFixed(1)}</span></div>)}</figure>);
        }
      }
      continue;
    }

    // 1. Horizontal divider (---, ***, ___)
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushList(i);
      blocks.push(
        <hr
          key={`hr-${i}`}
          className={`my-3 ${isUser ? 'border-white/30' : 'border-border/80'}`}
        />
      );
      continue;
    }

    // 2. Headings (###, ##, #)
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flushList(i);
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const isDisclaimer =
        headingText.includes('Yatırım Tavsiyesi') ||
        headingText.includes('YTD');

      if (level === 1) {
        blocks.push(
          <h2
            key={`h1-${i}`}
            className={`text-sm sm:text-base font-black mt-3 mb-1.5 ${
              isUser ? 'text-white' : 'text-text-primary'
            }`}
          >
            {renderInline(headingText, isUser)}
          </h2>
        );
      } else if (level === 2) {
        blocks.push(
          <h3
            key={`h2-${i}`}
            className={`text-xs sm:text-sm font-bold mt-2.5 mb-1 ${
              isUser ? 'text-white' : 'text-text-primary'
            }`}
          >
            {renderInline(headingText, isUser)}
          </h3>
        );
      } else {
        // level 3 or 4
        blocks.push(
          <h4
            key={`h3-${i}`}
            className={`text-xs font-bold mt-2 mb-1 flex items-center gap-1.5 ${
              isDisclaimer
                ? 'text-amber-500 dark:text-amber-400'
                : isUser
                ? 'text-white'
                : 'text-accent'
            }`}
          >
            {renderInline(headingText, isUser)}
          </h4>
        );
      }
      continue;
    }

    // 3. Bullet list item (*, -, •)
    const bulletMatch = line.match(/^(\s*)([\*\-\•])\s+(.+)$/);
    if (bulletMatch) {
      const itemText = bulletMatch[3];
      if (!currentList || currentList.type !== 'ul') {
        flushList(i);
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(itemText);
      continue;
    }

    // 4. Numbered list item (1., 2.)
    const numberMatch = line.match(/^(\s*)(\d+)[\.\)]\s+(.+)$/);
    if (numberMatch) {
      const itemText = numberMatch[3];
      if (!currentList || currentList.type !== 'ol') {
        flushList(i);
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(itemText);
      continue;
    }

    // Not a list item, flush any open list
    flushList(i);

    // 5. Empty line
    if (!trimmed) {
      blocks.push(<div key={`sp-${i}`} className="h-2" />);
      continue;
    }

    // 6. Regular paragraph
    blocks.push(
      <p key={`p-${i}`} className="leading-relaxed text-xs sm:text-sm my-1">
        {renderInline(trimmed, isUser)}
      </p>
    );
  }

  flushList('final');

  return <div className="space-y-2"><div id={contentId} className={`space-y-1 break-words ${collapsible && !expanded ? 'max-h-80 overflow-hidden [mask-image:linear-gradient(black_80%,transparent)]' : ''}`}>{blocks}</div>
    {collapsible && <button type="button" aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded(!expanded)} className="text-accent text-xs font-semibold">{expanded ? 'Daralt' : 'Daha fazla göster'}</button>}
  </div>;
}

export default ChatMessageContent;
