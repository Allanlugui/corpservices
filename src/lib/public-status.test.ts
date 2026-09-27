import { describe, expect, it } from "vitest";
import { labelCompraStatus, labelEvento, labelOsStatus, labelTicketStatus } from "./public-status";

describe("public-status", () => {
  it("rotula ticket convertido sem vazar sigla interna", () => {
    expect(labelTicketStatus("CONVERTIDO")).toBe("Encaminhada para execução");
    expect(labelTicketStatus("NOVO")).toBe("Recebida");
  });

  it("rotula OS e compra em pt-BR", () => {
    expect(labelOsStatus("EM_EXECUCAO")).toBe("Em execução");
    expect(labelOsStatus("ENCERRADA")).toBe("Encerrada");
    expect(labelCompraStatus("AGUARDANDO_APROVACAO")).toBe("Aguardando aprovação");
    expect(labelCompraStatus("EM_TRANSITO")).toBe("A caminho");
  });

  it("rotula eventos sem expor detalhe interno", () => {
    expect(labelEvento("COMPONENTE_RECEBIDO")).toBe("Material recebido");
    expect(labelEvento("CRIADO")).toBe("Recebida");
  });

  it("cai para formato legível em código desconhecido", () => {
    expect(labelEvento("ALGO_NOVO_X")).toBe("Algo Novo X");
  });
});
