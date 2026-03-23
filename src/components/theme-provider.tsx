'use client';

import { useEffect } from 'react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';

function AutoThemeByTime() {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (theme) return;
    const hour = new Date().getHours();
    setTheme(hour >= 6 && hour < 18 ? 'light' : 'dark');
  }, [theme, setTheme]);

  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AutoThemeByTime />
      {children}
    </NextThemesProvider>
  );
}
