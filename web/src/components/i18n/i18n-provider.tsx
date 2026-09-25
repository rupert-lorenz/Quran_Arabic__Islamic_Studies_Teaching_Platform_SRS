"use client";

import { createContext, useContext, useMemo } from "react";
import {
  defaultUiMessages,
  translateUi,
  type LocaleDirection,
  type UiMessageKey,
  type UiMessageVars,
  type UiMessages,
} from "@/lib/i18n";

type I18nContextValue = {
  locale: string;
  direction: LocaleDirection;
  messages: UiMessages;
  t: (key: UiMessageKey, vars?: UiMessageVars) => string;
};

const fallback: I18nContextValue = {
  locale: "en",
  direction: "ltr",
  messages: defaultUiMessages,
  t: (key, vars) => translateUi(defaultUiMessages, key, vars),
};

const I18nContext = createContext<I18nContextValue>(fallback);

export function I18nProvider({
  locale,
  direction,
  messages,
  children,
}: {
  locale: string;
  direction: LocaleDirection;
  messages: UiMessages;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      direction,
      messages,
      t: (key, vars) => translateUi(messages, key, vars),
    }),
    [locale, direction, messages],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function useT() {
  return useContext(I18nContext).t;
}
