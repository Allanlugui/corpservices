import { describe, expect, it } from "vitest";
import { dequeue, enqueue, loadQueue, markAttempt, type OutboxOp } from "./outbox";

describe("outbox", () => {
  const op = (key: string): OutboxOp => ({ key, type: "ticket.create", payload: {}, createdAt: 1, attempts: 0 });

  it("enfileira em ordem e ignora chave duplicada", () => {
    let q = enqueue([], { key: "a", type: "ticket.create", payload: {} });
    q = enqueue(q, { key: "a", type: "ticket.create", payload: {} });
    expect(q).toHaveLength(1);
  });

  it("remove e conta tentativas", () => {
    let q = [op("a"), op("b")];
    q = markAttempt(q, "a");
    expect(q.find((o) => o.key === "a")?.attempts).toBe(1);
    q = dequeue(q, "a");
    expect(q.map((o) => o.key)).toEqual(["b"]);
  });

  it("carrega vazio com armazenamento ausente ou corrompido", () => {
    expect(loadQueue(() => null)).toEqual([]);
    expect(loadQueue(() => "lixo{{{")).toEqual([]);
    const store = new Map([["corpservices.outbox.v1", JSON.stringify([op("a")])]]);
    expect(loadQueue((k) => store.get(k) ?? null)).toHaveLength(1);
  });
});
