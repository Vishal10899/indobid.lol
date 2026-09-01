'use client';

import React from 'react';
import Link from 'next/link';

interface FormattedTextProps {
  text: string;
  className?: string;
}

/**
 * Safely parses and renders text with interactive @mentions, #hashtags, and URLs.
 */
export function FormattedText({ text, className = '' }: FormattedTextProps) {
  if (!text) return null;

  // Tokenize by whitespace and punctuation boundaries while preserving mentions, tags, and URLs
  const tokenRegex = /(@[a-zA-Z0-9_]{2,30})|(#[a-zA-Z0-9_]{2,30})|(https?:\/\/[^\s]+)/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    // Push preceding plain text
    if (match.index > lastIndex) {
      elements.push(text.substring(lastIndex, match.index));
    }

    const token = match[0];
    const key = `token-${match.index}-${token}`;

    if (token.startsWith('@')) {
      const username = token.slice(1);
      elements.push(
        <Link
          key={key}
          href={`/profile/${username}`}
          onClick={(e) => e.stopPropagation()}
          className="font-bold text-[var(--color-coral)] hover:underline inline-block"
        >
          {token}
        </Link>
      );
    } else if (token.startsWith('#')) {
      const tag = token.slice(1);
      elements.push(
        <Link
          key={key}
          href={`/explore?category=${tag.toLowerCase()}&search=%23${encodeURIComponent(tag)}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-[var(--color-coral)] hover:underline inline-block"
        >
          {token}
        </Link>
      );
    } else if (token.startsWith('http://') || token.startsWith('https://')) {
      elements.push(
        <a
          key={key}
          href={token}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[var(--color-coral)] underline break-all hover:opacity-80 inline-block"
        >
          {token.length > 35 ? `${token.substring(0, 32)}...` : token}
        </a>
      );
    }

    lastIndex = match.index + token.length;
  }

  // Push remaining plain text
  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  return <span className={className}>{elements}</span>;
}

export default FormattedText;
