"use client";

import { Children, cloneElement, createContext, isValidElement, useContext, useEffect, useState, type ReactElement, type ReactNode } from "react";
import { translate, type Language } from "@/lib/i18n";

const LocaleContext = createContext<Language>("en");
const STORAGE_KEY = "scketch3dweb.language";

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Match server output first; restore the preference only after hydration.
  const [language, setLanguage] = useState<Language>("en");
  useEffect(() => {
    try { setLanguage(localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "ru"); }
    catch { setLanguage("ru"); }
  }, []);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  function change(next: Language) {
    setLanguage(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* Storage can be disabled. */ }
  }
  return <LocaleContext.Provider value={language}>
    {children}
    <div className="locale-switch" role="group" aria-label={language === "ru" ? "Язык интерфейса" : "Interface language"}>
      <button type="button" lang="ru" aria-pressed={language === "ru"} onClick={() => change("ru")}>RU</button>
      <button type="button" lang="en" aria-pressed={language === "en"} onClick={() => change("en")}>EN</button>
    </div>
  </LocaleContext.Provider>;
}

export function T({ text }: { text: ReactNode }) {
  const language = useContext(LocaleContext);
  return typeof text === "string" ? translate(text, language) : <>{text}</>;
}

// Translate only UI attributes; keep values, ids, names, refs and handlers intact.
export function L({ children }: { children: ReactElement }) {
  const language = useContext(LocaleContext);
  const child = Children.only(children);
  if (!isValidElement(child)) return child;
  const props = child.props as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const key of ["title", "aria-label", "aria-description", "placeholder", "alt", "label", "description", "tooltip", "hint"]) {
    if (typeof props[key] === "string") patch[key] = translate(props[key], language);
  }
  return cloneElement(child, patch);
}
