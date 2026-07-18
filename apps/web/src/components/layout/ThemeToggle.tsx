import { useEffect, useState } from "react";
import {
  applyTheme,
  getActiveTheme,
  getPreferredTheme,
  getSystemTheme,
  hasStoredTheme,
  isThemeStorageEvent,
  type ThemeMode,
} from "../../lib/theme";
import { MoonIcon, SunIcon } from "../ui/icons";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<ThemeMode>(() => getActiveTheme());

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const syncWithSystem = () => {
      if (hasStoredTheme()) return;
      const nextTheme = getSystemTheme();
      applyTheme(nextTheme);
      setTheme(nextTheme);
    };

    const syncAcrossTabs = (event: StorageEvent) => {
      if (!isThemeStorageEvent(event)) return;
      const nextTheme = getPreferredTheme();
      applyTheme(nextTheme);
      setTheme(nextTheme);
    };

    media.addEventListener("change", syncWithSystem);
    window.addEventListener("storage", syncAcrossTabs);

    return () => {
      media.removeEventListener("change", syncWithSystem);
      window.removeEventListener("storage", syncAcrossTabs);
    };
  }, []);

  const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
  const label = `Switch to ${nextTheme} theme`;

  return (
    <button
      type="button"
      className={`icon-button theme-toggle ${className}`.trim()}
      onClick={() => {
        applyTheme(nextTheme, true);
        setTheme(nextTheme);
      }}
      aria-label={label}
      title={label}
      aria-pressed={theme === "dark"}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      <span className="sr-only">{label}</span>
    </button>
  );
}
