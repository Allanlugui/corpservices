# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> acompanhar com token inválido mostra erro honesto
- Location: e2e\smoke.spec.ts:22:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('alert')
Expected pattern: /n.o encontramos|n[aã]o encontrada/i
Error: strict mode violation: getByRole('alert') resolved to 2 elements:
    1) <p role="alert" class="mt-4 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700">Não encontramos essa solicitação. Confira o link …</p> aka getByText('Não encontramos essa solicita')
    2) <div role="alert" aria-live="assertive" id="__next-route-announcer__"></div> aka locator('[id="__next-route-announcer__"]')

Call log:
  - Expect "toContainText" getByRole('alert') with timeout 5000ms
  - waiting for getByRole('alert')
    7 × locator resolved to <div role="alert" aria-live="assertive" id="__next-route-announcer__"></div>
      - unexpected value ""

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Pular para o conteúdo" [ref=e2] [cursor=pointer]:
    - /url: "#conteudo"
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - link "CorpServices" [ref=e6] [cursor=pointer]:
          - /url: /solicitar
        - generic [ref=e7]: Portal do solicitante
    - main [ref=e8]:
      - generic [ref=e9]:
        - generic [ref=e10]:
          - paragraph [ref=e11]: CorpServices
          - heading "Acompanhar solicitação" [level=1] [ref=e12]
          - paragraph [ref=e13]: Cole seu protocolo. Sem login, sem complicação.
        - generic [ref=e16]:
          - textbox "Código de acompanhamento" [ref=e17]:
            - /placeholder: Cole o código do link
            - text: 00000000-0000-0000-0000-000000000000
          - button "Buscar" [ref=e18]
        - alert [ref=e19]: Não encontramos essa solicitação. Confira o link recebido.
        - paragraph [ref=e20]:
          - link "← Fazer nova solicitação" [ref=e21] [cursor=pointer]:
            - /url: /solicitar
    - contentinfo [ref=e22]: CorpServices · canal público de solicitações
  - button "Open Next.js Dev Tools" [ref=e28] [cursor=pointer]
  - alert [ref=e32]
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | /**
  4  |  * Smoke E2E (P-12, §37): somente leitura + entradas inválidas.
  5  |  * Nada cria, altera ou apaga dados — seguro contra qualquer ambiente.
  6  |  */
  7  | 
  8  | test("health responde 200 com integrações", async ({ request }) => {
  9  |   const res = await request.get("/api/health");
  10 |   expect(res.ok()).toBe(true);
  11 |   const json = await res.json();
  12 |   expect(json.data.status).toBe("ok");
  13 |   expect(Array.isArray(json.data.integrations)).toBe(true);
  14 | });
  15 | 
  16 | test("portal /solicitar abre com assistente", async ({ page }) => {
  17 |   await page.goto("/solicitar");
  18 |   await expect(page.getByRole("heading", { name: /nova solicita/i })).toBeVisible();
  19 |   await expect(page.getByRole("tab", { name: /assistente/i })).toBeVisible();
  20 | });
  21 | 
  22 | test("acompanhar com token inválido mostra erro honesto", async ({ page }) => {
  23 |   await page.goto("/solicitar/acompanhar?token=00000000-0000-0000-0000-000000000000");
> 24 |   await expect(page.getByRole("alert")).toContainText(/n.o encontramos|n[aã]o encontrada/i);
     |                                         ^ Error: expect(locator).toContainText(expected) failed
  25 | });
  26 | 
  27 | test("rota interna sem login redireciona", async ({ page }) => {
  28 |   await page.goto("/os");
  29 |   await expect(page).toHaveURL(/\/login/);
  30 | });
  31 | 
  32 | test("locais públicos listam sem auth", async ({ request }) => {
  33 |   const res = await request.get("/api/locais/public");
  34 |   expect(res.ok()).toBe(true);
  35 |   const json = await res.json();
  36 |   expect(Array.isArray(json.data.locations)).toBe(true);
  37 | });
  38 | 
  39 | test("bot interpret rejeita payload inválido", async ({ request }) => {
  40 |   const res = await request.post("/api/bot/interpret", { data: { task: "invalida", text: "oi" } });
  41 |   expect(res.status()).toBe(422);
  42 | });
  43 | 
  44 | test("relatórios exigem login", async ({ request }) => {
  45 |   const res = await request.get("/api/relatorios?entity=tickets");
  46 |   expect([401, 403, 307]).toContain(res.status());
  47 | });
  48 | 
```