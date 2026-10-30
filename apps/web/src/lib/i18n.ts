import russian from "@/lib/ru-ui.json";
export type Language = "ru" | "en";
const dictionary: Record<string, string> = russian;
const folded = new Map(Object.entries(dictionary).map(([en, ru]) => [en.toLowerCase(), ru]));
const patterns: [RegExp, (...groups: string[]) => string][] = [
  [/^Rename face label: (.+)$/, (name) => `Переименовать метку грани: ${name}`],
  [/^Delete face label: (.+)$/, (name) => `Удалить метку грани: ${name}`],
  [/^Increase (.+)$/, (label) => `Увеличить: ${dictionary[label] ?? label}`],
  [/^Decrease (.+)$/, (label) => `Уменьшить: ${dictionary[label] ?? label}`],
  [/^(\d+) min ago$/, (n) => `${n} мин. назад`],
  [/^Update to (.+)$/, (version) => `Обновить до ${version}`],
  [/^(?:Scketch3Dweb|Scketch3Dweb) (.+) is available$/, (version) => `Доступна версия Scketch3Dweb ${version}`],
  [/^(.+) selected$/, (count) => `Выбрано: ${count}`],
  [/^Exported (\d+) selected shapes? as (.+)$/, (count, format) => `Экспортировано фигур: ${count}, формат ${format}`],
  [/^Exported (.+)$/, (format) => `Экспортировано: ${format}`],
  [/^Export (.+)$/, (format) => `Экспорт ${dictionary[format] ?? format}`],
  [/^Cancel (.+)$/, (operation) => `Отменить: ${dictionary[operation] ?? folded.get(operation.toLowerCase()) ?? operation}`],
  [/^(\d+) grouped objects$/, (count) => `Объектов в группе: ${count}`],
  [/^(\d+) selected$/, (count) => `Выбрано: ${count}`],
  [/^(\d+) total$/, (count) => `Всего: ${count}`],
  [/^([\d.]+) mm$/, (number) => `${number} мм`],
  [/^ · (\d+) existing edge features?$/, (count) => ` · обработок рёбер: ${count}`],
  [/^Saved (.+) to (.+)$/, (format, file) => `Сохранено ${format}: ${file}`],
  [/^Imported (\d+) (.+)$/, (count, what) => `Импортировано: ${count} ${what}`],
  [/^MCP selected (\d+) objects?$/, (count) => `MCP: выбрано объектов — ${count}`],
  [/^(.+) added by MCP$/, (name) => `MCP: добавлен объект «${name}»`],
  [/^(.+) updated by MCP$/, (name) => `MCP: обновлён объект «${name}»`],
  [/^(.+) imported by MCP$/, (name) => `MCP: импортирован объект «${name}»`],
];

export function translate(value: string, language: Language): string {
  const normalized = value.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&deg;/g, "°").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  if (language === "en") return normalized;
  const key = normalized.trim();
  const translated = dictionary[key] ?? dictionary[value.trim()] ?? folded.get(key.toLowerCase());
  if (translated) return normalized.slice(0, normalized.length - normalized.trimStart().length) + translated + normalized.slice(normalized.trimEnd().length);
  for (const [pattern, render] of patterns) {
    const match = key.match(pattern);
    if (match) return render(...match.slice(1));
  }
  return normalized;
}
