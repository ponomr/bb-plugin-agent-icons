/**
 * Every string the app produces itself. English is the default; `ru` must have
 * the same keys, so a missing translation breaks typecheck. Strings with
 * parameters are functions. Server refusals are localized by the server.
 */
import { createContext, createElement, useContext, type ReactNode } from "react";
import { DEFAULT_LANGUAGE, parseLanguage, type Language } from "../shared/i18n";

export const en = {
  // Settings page
  loading: "Loading…",
  retry: "Retry",
  loadFailed: (reason: string) => `Could not load assignments: ${reason}`,
  unknownError: "unknown error",
  otherDevicesNotice: "Other devices need a reload too; a device that was closed may need two.",
  notInBb: "Not in bb",
  assignmentsTitle: "Assignments",
  providersTitle: "Providers",
  providersDescription: "An icon and a colour for each theme. Without a colour the icon is tinted like the original.",
  providersUnavailable: "The bb provider list is unavailable; only assignments are shown.",
  setsTitle: "Icon sets",
  setsDescription: "Your own SVGs, uploaded as sets. Code, links and colours in the files are removed.",

  // Provider row
  reloadNotice: "Appears after the app is reloaded on this device",
  originalIcon: "Original icon",
  builtinSource: (name: string) => `Built-in: ${name}`,
  lightColor: (color: string) => `light ${color}`,
  darkColor: (color: string) => `dark ${color}`,
  notReset: (reason: string) => `Not reset: ${reason}`,
  change: "Change",
  changeIconOf: (name: string) => `Change icon: ${name}`,
  reset: "Reset",
  resetOf: (name: string) => `Reset: ${name}`,
  resetting: "Resetting…",

  // Confirm dialog
  affectedGetOriginal: (names: string) => `These will get their original icon: ${names}.`,
  noProviderUsesIcon: "No provider uses this icon.",
  notDeleted: (reason: string) => `Not deleted: ${reason}`,
  cancel: "Cancel",
  delete: "Delete",
  deleting: "Deleting…",

  // Icon grid
  filterByName: "Filter by name",
  nothingFound: "Nothing found",

  // Tint editor
  lightTheme: "Light theme",
  darkTheme: "Dark theme",
  paletteOf: (theme: string) => `${theme}: palette`,
  colorOf: (theme: string) => `${theme}: colour`,
  colorFormat: "Colour as #rrggbb",
  originalColor: "Original colour",

  // Icon picker
  iconOf: (name: string) => `Icon: ${name}`,
  builtinTab: "Built-in",
  iconSets: "Icon sets",
  setLoadFailed: (reason: string) => `Could not load the set: ${reason}`,
  setEmpty: "The set has no icons",
  notSaved: (reason: string) => `Not saved: ${reason}`,
  save: "Save",
  saving: "Saving…",

  // Sets manager
  usage: (used: string, max: string) =>
    `Used ${used} of ${max} MB. SVG only, up to 32 KB per file and 200 icons per set; icons are single-colour.`,
  newSetName: "New set name",
  newSetPlaceholder: "Set name (defaults to the first file)",
  defaultSetName: "Set",
  uploadSet: "Upload set",
  addFiles: "Add files",
  uploading: "Uploading…",
  noSets: "No sets",
  show: "Icons",
  hide: "Hide",
  setCount: (icons: number, kb: number) => `${icons} ${icons === 1 ? "icon" : "icons"} · ${kb} KB`,
  deleteSetOf: (name: string) => `Delete set ${name}`,
  deleteSetTitle: (name: string) => `Delete set "${name}"?`,
  deleteIconOf: (name: string) => `Delete icon ${name}`,
  deleteIconTitle: (name: string) => `Delete icon "${name}"?`,
  setName: "Set name",
  iconName: "Icon name",
  nameOf: (label: string, value: string) => `${label}: ${value}`,
  loadItemFailed: (reason: string) => `Could not load: ${reason}`,
  uploadSummary: (set: string, accepted: number, rejected: number) =>
    `Set "${set}": ${accepted} accepted, ${rejected} rejected`,
  uploadInterrupted: (reason: string) => `Upload interrupted: ${reason}`,
  notSvg: "not an SVG",
};

export type Strings = typeof en;

export const ru: Strings = {
  loading: "Загрузка…",
  retry: "Повторить",
  loadFailed: (reason) => `Не удалось загрузить назначения: ${reason}`,
  unknownError: "неизвестная ошибка",
  otherDevicesNotice: "Другим устройствам тоже нужна перезагрузка; если устройство было закрыто, может понадобиться две.",
  notInBb: "Нет в bb",
  assignmentsTitle: "Назначения",
  providersTitle: "Провайдеры",
  providersDescription: "Иконка и цвет для каждой темы. Без цвета иконка окрашивается как прежняя.",
  providersUnavailable: "Список провайдеров bb недоступен; показаны только назначения.",
  setsTitle: "Наборы иконок",
  setsDescription: "Свои SVG, загруженные наборами. Код, ссылки и цвета из файлов удаляются.",

  reloadNotice: "Появится после перезагрузки приложения на этом устройстве",
  originalIcon: "Исходная иконка",
  builtinSource: (name) => `Встроенная: ${name}`,
  lightColor: (color) => `светлая ${color}`,
  darkColor: (color) => `тёмная ${color}`,
  notReset: (reason) => `Не сброшено: ${reason}`,
  change: "Изменить",
  changeIconOf: (name) => `Изменить иконку: ${name}`,
  reset: "Сбросить",
  resetOf: (name) => `Сбросить: ${name}`,
  resetting: "Сброс…",

  affectedGetOriginal: (names) => `Исходную иконку получат: ${names}.`,
  noProviderUsesIcon: "Ни один провайдер эту иконку не использует.",
  notDeleted: (reason) => `Не удалено: ${reason}`,
  cancel: "Отмена",
  delete: "Удалить",
  deleting: "Удаление…",

  filterByName: "Фильтр по имени",
  nothingFound: "Ничего не найдено",

  lightTheme: "Светлая тема",
  darkTheme: "Тёмная тема",
  paletteOf: (theme) => `${theme}: палитра`,
  colorOf: (theme) => `${theme}: цвет`,
  colorFormat: "Цвет в виде #rrggbb",
  originalColor: "Исходный цвет",

  iconOf: (name) => `Иконка: ${name}`,
  builtinTab: "Встроенные",
  iconSets: "Наборы иконок",
  setLoadFailed: (reason) => `Не удалось загрузить набор: ${reason}`,
  setEmpty: "В наборе нет иконок",
  notSaved: (reason) => `Не сохранено: ${reason}`,
  save: "Сохранить",
  saving: "Сохранение…",

  usage: (used, max) =>
    `Занято ${used} из ${max} МБ. Только SVG, до 32 КБ на файл и 200 иконок в наборе; иконки одноцветные.`,
  newSetName: "Имя нового набора",
  newSetPlaceholder: "Имя набора (иначе по первому файлу)",
  defaultSetName: "Набор",
  uploadSet: "Загрузить набор",
  addFiles: "Добавить файлы",
  uploading: "Загрузка…",
  noSets: "Наборов нет",
  show: "Иконки",
  hide: "Скрыть",
  setCount: (icons, kb) => `${icons} икон. · ${kb} КБ`,
  deleteSetOf: (name) => `Удалить набор ${name}`,
  deleteSetTitle: (name) => `Удалить набор «${name}»?`,
  deleteIconOf: (name) => `Удалить иконку ${name}`,
  deleteIconTitle: (name) => `Удалить иконку «${name}»?`,
  setName: "Имя набора",
  iconName: "Имя иконки",
  nameOf: (label, value) => `${label}: ${value}`,
  loadItemFailed: (reason) => `Не удалось загрузить: ${reason}`,
  uploadSummary: (set, accepted, rejected) => `Набор «${set}»: принято ${accepted}, отклонено ${rejected}`,
  uploadInterrupted: (reason) => `Загрузка прервана: ${reason}`,
  notSvg: "не SVG",
};

const tables: Record<Language, Strings> = { en, ru };

/** Unknown or missing language gives English. */
export function strings(language?: unknown): Strings {
  return tables[parseLanguage(language)];
}

const LanguageContext = createContext<Language>(DEFAULT_LANGUAGE);

/** Provides the language of the loaded state to the settings tree. */
export function LanguageProvider({ language, children }: { language: unknown; children: ReactNode }) {
  return createElement(LanguageContext.Provider, { value: parseLanguage(language) }, children);
}

export function useLanguage(): Language {
  return useContext(LanguageContext);
}

export function useStrings(): Strings {
  return tables[useLanguage()];
}
