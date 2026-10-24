export interface ComponentFixtureDefinition {
  readonly height: number;
  readonly id: string;
  readonly width: number;
}

export const COMPONENT_FIXTURES = [
  { id: "alert", width: 840, height: 180 },
  { id: "badge", width: 720, height: 140 },
  { id: "brand", width: 760, height: 160 },
  { id: "button", width: 900, height: 220 },
  { id: "card", width: 900, height: 300 },
  { id: "checkbox", width: 720, height: 160 },
  { id: "command", width: 900, height: 380 },
  { id: "conversion-popup-empty", width: 1000, height: 540 },
  { id: "conversion-popup-error", width: 1000, height: 540 },
  { id: "conversion-popup-loading", width: 1000, height: 540 },
  { id: "conversion-popup-success", width: 1000, height: 760 },
  { id: "conversion-editor", width: 1000, height: 700 },
  { id: "conversion-editor-editing", width: 1000, height: 760 },
  { id: "conversion-editor-full", width: 1000, height: 700 },
  { id: "currency-value-row", width: 900, height: 180 },
  { id: "currency-catalog", width: 1000, height: 560 },
  { id: "currency-combobox", width: 900, height: 180 },
  { id: "currency-combobox-open", width: 900, height: 500 },
  { id: "currency-icons", width: 760, height: 180 },
  { id: "currency-identity", width: 760, height: 180 },
  { id: "floating-icon", width: 720, height: 360 },
  { id: "hover-tooltip", width: 720, height: 220 },
  { id: "icon-button", width: 720, height: 180 },
  { id: "input", width: 840, height: 190 },
  { id: "native-select", width: 840, height: 180 },
  { id: "popover", width: 900, height: 330 },
  { id: "reorderable-currency-list", width: 1000, height: 390 },
  { id: "reorderable-currency-list-dragging", width: 1000, height: 390 },
  { id: "section-header", width: 900, height: 180 },
  { id: "skeleton", width: 840, height: 190 },
  { id: "stack", width: 760, height: 220 },
  { id: "symbol-settings", width: 1000, height: 760 },
  { id: "tooltip", width: 720, height: 220 },
] as const satisfies readonly ComponentFixtureDefinition[];

export type ComponentFixtureId = (typeof COMPONENT_FIXTURES)[number]["id"];
