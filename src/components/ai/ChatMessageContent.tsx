'use client';

import React from 'react';

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
            href={linkMatch[2]}
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
  if (!content) return null;

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
        headingText.includes('YTD') ||
        headingText.includes('⚠️');

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

  return <div className="space-y-1 break-words">{blocks}</div>;
}

export default ChatMessageContent;
