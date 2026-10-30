import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { translate } from "@/lib/i18n";

describe("face label panel localization", () => {
  const strings = {
    "Face labels": "Метки граней",
    "Object properties and face labels": "Параметры объекта и метки граней",
    "Hide labels on model": "Скрыть метки на модели",
    "Show labels on model": "Показать метки на модели",
    "Face label": "Метка грани",
    "Click a planar face and enter a name. Esc to exit.": "Нажмите на плоскую грань и задайте имя. Esc — выход.",
    "Face selected. Enter a name.": "Грань выделена. Введите имя.",
    "Face name": "Имя грани",
    "For example: fan flange": "Например: фланец вентилятора",
    "Save label": "Сохранить метку",
    "Attachment is outdated": "Привязка устарела",
  };

  it("provides English and Russian panel strings", () => {
    for (const [english, russian] of Object.entries(strings)) {
      expect(translate(english, "en")).toBe(english);
      expect(translate(english, "ru")).toBe(russian);
    }
  });

  it("preserves user-defined names in translated action labels", () => {
    expect(translate("Rename face label: Fan flange", "ru")).toBe("Переименовать метку грани: Fan flange");
    expect(translate("Delete face label: Фланец", "en")).toBe("Delete face label: Фланец");
    expect(translate("Delete face label: Фланец", "ru")).toBe("Удалить метку грани: Фланец");
  });

  it("does not hardcode Russian text in the panel JSX", () => {
    const source = readFileSync("apps/web/src/components/WorkplaneViewport.tsx", "utf8");
    const panel = source.slice(source.indexOf('<L><aside className="face-annotations-panel"'), source.indexOf("{!selectedShape ? ("));
    expect(panel).toContain('<T text="Face labels" />');
    expect(panel).not.toMatch(/[А-Яа-яЁё]/);
  });
});
