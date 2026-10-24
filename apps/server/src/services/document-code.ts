import type prisma from "@dms/db";

type TransactionTx = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

type DocumentType = "sale" | "purchase" | "return" | "payment";

export async function nextDocumentCode(
  tx: TransactionTx,
  organizationId: string,
  documentType: DocumentType,
  date = new Date()
): Promise<string> {
  const sequenceType = documentType === "sale" ? `sale-${date.getFullYear()}` : documentType;

  const sequence = await tx.documentSequence.upsert({
    where: { organizationId_type: { organizationId, type: sequenceType } },
    create: { organizationId, type: sequenceType, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
    select: { lastNumber: true },
  });

  const prefix = {
    sale: `SALE-${date.getFullYear()}`,
    purchase: "PO",
    return: "RET",
    payment: "PMT",
  }[documentType];

  return `${prefix}-${String(sequence.lastNumber).padStart(5, "0")}`;
}
