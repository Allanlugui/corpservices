import { expect, test } from "@playwright/test";

/**
 * Smoke E2E (P-12, §37): somente leitura + entradas inválidas.
 * Nada cria, altera ou apaga dados — seguro contra qualquer ambiente.
 */

test("health responde 200 com integrações", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  const json = await res.json();
  expect(["ok", "up"]).toContain(json.data.status);
  expect(Array.isArray(json.data.integrations)).toBe(true);
});

test("portal /solicitar abre com assistente", async ({ page }) => {
  await page.goto("/solicitar");
  await expect(page.getByRole("heading", { name: /nova solicita/i })).toBeVisible();
  await expect(page.getByRole("tab", { name: /assistente/i })).toBeVisible();
});

test("acompanhar com token inválido mostra erro honesto", async ({ page }) => {
  await page.goto("/solicitar/acompanhar?token=00000000-0000-0000-0000-000000000000");
  await expect(page.getByRole("alert").filter({ hasText: /encontramos|encontrada/i }).first()).toBeVisible();
});

test("rota interna sem login redireciona", async ({ page }) => {
  await page.goto("/os");
  await expect(page).toHaveURL(/\/login/);
});

test("locais públicos listam sem auth", async ({ request }) => {
  const res = await request.get("/api/locais/public");
  expect(res.ok()).toBe(true);
  const json = await res.json();
  expect(Array.isArray(json.data.locations)).toBe(true);
});

test("bot interpret rejeita payload inválido", async ({ request }) => {
  const res = await request.post("/api/bot/interpret", { data: { task: "invalida", text: "oi" } });
  expect(res.status()).toBe(422);
});

test("relatórios exigem login", async ({ request }) => {
  const res = await request.get("/api/relatorios?entity=tickets");
  expect([401, 403, 307]).toContain(res.status());
});
