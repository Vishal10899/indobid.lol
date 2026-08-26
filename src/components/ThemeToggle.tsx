'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const cookieMatch = document.cookie.match(/(?:^|; )theme=([^;]*)/);
    const cookieTheme = cookieMatch ? cookieMatch[1] : null;
    const saved =
      localStorage.getItem('theme') ||
      localStorage.getItem('indobid_theme') ||
      cookieTheme;

    const isDark =
      saved === 'dark' ||
      (!saved && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const currentTheme = isDark ? 'dark' : 'light';
    setTheme(currentTheme);

    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);

    // Save to localStorage
    localStorage.setItem('theme', nextTheme);
    localStorage.setItem('indobid_theme', nextTheme);

    // Save to cookie for seamless SSR match
    document.cookie = `theme=${nextTheme};path=/;max-age=31536000;SameSite=Lax`;

    // Apply class
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  if (!mounted) {
    return (
      <div
        className={`w-8 h-8 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] ${className}`}
      />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle dark / light mode"
      className={`w-8 h-8 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition cursor-pointer shadow-2xs ${className}`}
    >
      {theme === 'light' ? (
        <Moon className="w-4 h-4" />
      ) : (
        <Sun className="w-4 h-4 text-amber-400" />
      )}
    </button>
  );
}
