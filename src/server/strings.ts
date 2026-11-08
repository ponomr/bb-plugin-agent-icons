/**
 * Server and CLI user-facing text, one flat table per language. `ru` is typed
 * as `typeof en`, so a missing Russian key fails typecheck. Parameterized
 * strings are functions. CLI help registered by `defineCli` is static English
 * and lives in cli.ts, because it is registered once.
 */
import { DEFAULT_LANGUAGE, type Language } from "../shared/i18n";

export const en = {
  // Refusals (state.ts)
  iconNotInSet: "icon not found in the set",
  setNotFound: "set not found",
  noBuiltinIcon: (name: string) => `there is no built-in icon ${name}`,
  setExists: (name: string) => `set "${name}" already exists`,
  iconExists: (name: string) => `the set already has an icon "${name}"`,
  // Upload rejections (state.ts)
  setFull: (limit: number) => `the set already has ${limit} icons, which is the limit`,
  iconTooComplex: "icon is too complex to store",
  noSpace: (used: string, limit: string) => `no space: ${used} of ${limit} MB used`,
  // Sanitizer reasons
  parseFailed: (detail: string) => `could not parse SVG: ${detail}`,
  treeInvalid: "could not parse SVG: the tree failed validation",
  rootNotSvg: "root element is not svg",
  noViewBox: "no viewBox and no numeric width and height",
  noShapes: "no shapes",
  // CLI
  colorFormat: (flag: string) => `${flag}: color must look like #rrggbb`,
  tintLight: (color: string) => `light ${color}`,
  tintDark: (color: string) => `dark ${color}`,
  providersHeading: "Providers:",
  originalIcon: "original icon",
  providersUnavailable: "The bb provider list is unavailable; showing assignments only.",
  notInBb: "Not in bb:",
  assignmentsHeading: "Assignments:",
  setsHeading: "Sets:",
  none: "none",
  setLine: (name: string, id: string, count: number, kb: number) =>
    `${name} (${id}): ${count} ${count === 1 ? "icon" : "icons"}, ${kb} KB`,
  builtinsLine: (names: string) => `Built-in (builtin:<Name>): ${names}`,
  folderNotFound: (dir: string) => `folder not found: ${dir}`,
  invalidProviderId: "invalid provider id",
  iconSyntax: "the icon is given as builtin:<Name> or <set>/<icon>",
  setNamedNotFound: (name: string) => `set "${name}" not found`,
  iconNotInNamedSet: (icon: string, set: string) => `icon "${icon}" is not in set "${set}"`,
  assigned: (providerId: string, ref: string) =>
    `${providerId}: assigned ${ref}. If the provider has not appeared on a device yet, reload the bb page.`,
  assignmentCleared: (providerId: string) => `${providerId}: assignment cleared`,
  noAssignment: (providerId: string) => `${providerId}: there was no assignment`,
  noSvgInFolder: (dir: string) => `no .svg files in the folder: ${dir}`,
  emptySetName: "set name cannot be empty",
  importSummary: (name: string, accepted: number, rejected: number) =>
    `Set "${name}": ${accepted} accepted, ${rejected} rejected`,
};

export const ru: typeof en = {
  iconNotInSet: "иконка не найдена в наборе",
  setNotFound: "набор не найден",
  noBuiltinIcon: (name) => `встроенного значка ${name} нет`,
  setExists: (name) => `набор «${name}» уже есть`,
  iconExists: (name) => `в наборе уже есть иконка «${name}»`,
  setFull: (limit) => `в наборе уже ${limit} иконок, это предел`,
  iconTooComplex: "иконка слишком сложная для хранения",
  noSpace: (used, limit) => `нет места: занято ${used} из ${limit} МБ`,
  parseFailed: (detail) => `не удалось разобрать SVG: ${detail}`,
  treeInvalid: "не удалось разобрать SVG: дерево не прошло проверку",
  rootNotSvg: "корневой элемент не svg",
  noViewBox: "нет viewBox и числовых width и height",
  noShapes: "нет фигур",
  colorFormat: (flag) => `${flag}: цвет должен быть в виде #rrggbb`,
  tintLight: (color) => `светлая ${color}`,
  tintDark: (color) => `тёмная ${color}`,
  providersHeading: "Провайдеры:",
  originalIcon: "исходная иконка",
  providersUnavailable: "Список провайдеров bb недоступен; показаны только назначения.",
  notInBb: "Нет в bb:",
  assignmentsHeading: "Назначения:",
  setsHeading: "Наборы:",
  none: "нет",
  setLine: (name, id, count, kb) => `${name} (${id}): ${count} икон., ${kb} КБ`,
  builtinsLine: (names) => `Встроенные (builtin:<Имя>): ${names}`,
  folderNotFound: (dir) => `папка не найдена: ${dir}`,
  invalidProviderId: "недопустимый id провайдера",
  iconSyntax: "иконка задаётся как builtin:<Имя> или <набор>/<иконка>",
  setNamedNotFound: (name) => `набор «${name}» не найден`,
  iconNotInNamedSet: (icon, set) => `иконки «${icon}» нет в наборе «${set}»`,
  assigned: (providerId, ref) =>
    `${providerId}: назначено ${ref}. Если провайдер ещё не встречался на устройстве, перезагрузите страницу bb.`,
  assignmentCleared: (providerId) => `${providerId}: назначение снято`,
  noAssignment: (providerId) => `${providerId}: назначения не было`,
  noSvgInFolder: (dir) => `в папке нет файлов .svg: ${dir}`,
  emptySetName: "имя набора не может быть пустым",
  importSummary: (name, accepted, rejected) => `Набор «${name}»: принято ${accepted}, отклонено ${rejected}`,
};

export type Strings = typeof en;

export function strings(language: Language = DEFAULT_LANGUAGE): Strings {
  return language === "ru" ? ru : en;
}
