import { describe, expect, it } from "vitest";
import { MAX_PAGE_SIZE, pageParams } from "./pagination";

describe("pageParams", () => {
  it("pagina 1 por padrão", () => {
    expect(pageParams({})).toEqual({ page: 1, pageSize: 10, from: 0, to: 9 });
  });

  it("calcula janela", () => {
    expect(pageParams({ page: 3, page_size: 10 })).toEqual({ page: 3, pageSize: 10, from: 20, to: 29 });
  });

  it("limita page_size ao máximo e normaliza inválidos", () => {
    expect(pageParams({ page_size: 9999 }).pageSize).toBe(MAX_PAGE_SIZE);
    expect(pageParams({ page: -2, page_size: 0 }).page).toBe(1);
  });
});
