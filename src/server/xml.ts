/**
 * A strict, dependency-free XML reader for small SVG icons. It never expands
 * custom entities or DOCTYPE declarations (XXE, billion laughs), ignores text,
 * CDATA, comments and processing instructions, and rejects anything it does
 * not understand instead of guessing.
 */
import { MAX_TREE_DEPTH, MAX_TREE_NODES } from "../shared/limits";

export interface XmlElement {
  name: string;
  attrs: Array<[string, string]>;
  children: XmlElement[];
}

export class XmlParseError extends Error {}

const NAME = /[A-Za-z_][-A-Za-z0-9_.:]*/y;
const PREDEFINED: Record<string, string> = {
  lt: "<",
  gt: ">",
  amp: "&",
  quot: '"',
  apos: "'",
};

function decodeEntities(raw: string): string {
  return raw.replace(/&([^;&\s]*);?/g, (match, body: string) => {
    if (!match.endsWith(";")) throw new XmlParseError("одиночный символ &");
    if (body in PREDEFINED) return PREDEFINED[body]!;
    const numeric = /^#(?:x([0-9a-fA-F]{1,6})|([0-9]{1,7}))$/.exec(body);
    if (numeric) {
      const code = numeric[1] ? parseInt(numeric[1], 16) : parseInt(numeric[2]!, 10);
      if (code === 0 || code > 0x10ffff) throw new XmlParseError("недопустимый код символа");
      return String.fromCodePoint(code);
    }
    throw new XmlParseError(`сущность &${body}; не поддерживается`);
  });
}

export function parseXml(text: string): XmlElement {
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const stack: XmlElement[] = [];
  let root: XmlElement | null = null;
  let nodes = 0;

  const fail = (message: string): never => {
    throw new XmlParseError(message);
  };

  const skipUntil = (terminator: string, what: string) => {
    const end = text.indexOf(terminator, i);
    if (end < 0) fail(`незакрытый ${what}`);
    i = end + terminator.length;
  };

  const readName = (): string => {
    NAME.lastIndex = i;
    const match = NAME.exec(text);
    if (!match) return fail("ожидалось имя тега или атрибута");
    i += match[0].length;
    return match[0];
  };

  const skipSpace = () => {
    while (i < text.length && /\s/.test(text[i]!)) i += 1;
  };

  while (i < text.length) {
    if (text[i] !== "<") {
      const end = text.indexOf("<", i);
      const chunk = text.slice(i, end < 0 ? text.length : end);
      decodeEntities(chunk);
      if (stack.length === 0 && chunk.trim() !== "") fail("текст вне корневого элемента");
      i = end < 0 ? text.length : end;
      continue;
    }

    if (text.startsWith("<?", i)) {
      skipUntil("?>", "блок <?");
      continue;
    }
    if (text.startsWith("<!--", i)) {
      skipUntil("-->", "комментарий");
      continue;
    }
    if (text.startsWith("<![CDATA[", i)) {
      if (stack.length === 0) fail("CDATA вне корневого элемента");
      skipUntil("]]>", "CDATA");
      continue;
    }
    if (text.slice(i, i + 9).toUpperCase() === "<!DOCTYPE") {
      if (root || stack.length > 0) fail("DOCTYPE после начала документа");
      const close = text.indexOf(">", i);
      const bracket = text.indexOf("[", i);
      if (close < 0) fail("незакрытый DOCTYPE");
      if (bracket >= 0 && bracket < close) fail("DOCTYPE с объявлениями запрещён");
      i = close + 1;
      continue;
    }
    if (text.startsWith("<!", i)) fail("неизвестное объявление <!");

    if (text.startsWith("</", i)) {
      i += 2;
      const name = readName();
      skipSpace();
      if (text[i] !== ">") fail(`ожидался > после </${name}`);
      i += 1;
      const open = stack.pop();
      if (!open || open.name !== name) fail(`лишний закрывающий тег </${name}>`);
      continue;
    }

    // Opening tag.
    i += 1;
    if (root && stack.length === 0) fail("второй корневой элемент");
    const element: XmlElement = { name: readName(), attrs: [], children: [] };
    nodes += 1;
    if (nodes > MAX_TREE_NODES) fail(`больше ${MAX_TREE_NODES} элементов`);
    if (stack.length >= MAX_TREE_DEPTH) fail(`вложенность больше ${MAX_TREE_DEPTH}`);

    const seen = new Set<string>();
    let selfClosing = false;
    for (;;) {
      const before = i;
      skipSpace();
      if (text.startsWith("/>", i)) {
        i += 2;
        selfClosing = true;
        break;
      }
      if (text[i] === ">") {
        i += 1;
        break;
      }
      if (i >= text.length) fail(`незакрытый тег <${element.name}>`);
      if (i === before) fail(`ожидался пробел перед атрибутом в <${element.name}>`);
      const attrName = readName();
      skipSpace();
      if (text[i] !== "=") fail(`у атрибута ${attrName} нет значения`);
      i += 1;
      skipSpace();
      const quote = text[i];
      if (quote !== '"' && quote !== "'") fail(`значение ${attrName} без кавычек`);
      const end = text.indexOf(quote!, i + 1);
      if (end < 0) fail(`незакрытое значение ${attrName}`);
      const raw = text.slice(i + 1, end);
      if (raw.includes("<")) fail(`символ < в значении ${attrName}`);
      if (seen.has(attrName)) fail(`атрибут ${attrName} повторяется`);
      seen.add(attrName);
      element.attrs.push([attrName, decodeEntities(raw)]);
      i = end + 1;
    }

    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(element);
    else root = element;
    if (!selfClosing) stack.push(element);
  }

  if (stack.length > 0) fail(`незакрытый тег <${stack[stack.length - 1]!.name}>`);
  if (!root) fail("нет корневого элемента");
  return root!;
}
