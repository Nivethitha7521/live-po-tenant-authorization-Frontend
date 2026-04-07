// src/Models/debitCreditNoteModel.ts
export interface ItemDetail {
  itemId: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  finalPrice: number;
  sgst?: number;
  cgst?: number;
  igst?: number;
  taxType?: string;
  noteType?: string;
  reason?: string;
  hsnCode?: string;
  uom?: string;
}

// src/Models/debitCreditNote.ts (or wherever your types are defined)
export interface DebitCreditNote {
  noteId: string;
  randomId: string;
  vendorName: string;
  itemDetails: Array<{
    itemId: string;
    itemName: string;
    unitPrice: number;
    quantity: number;
    totalPrice:number;
    finalPrice: number;
    noteType: string;
    reason: string;
    sgst?: number;
    cgst?: number;
    igst?: number;
  }>;
  documentId: string; // Add this property to fix the TypeScript error
  documentType?: string;
}