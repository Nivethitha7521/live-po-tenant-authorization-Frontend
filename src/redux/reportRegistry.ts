// reportRegistry.ts

import { dispatchConfig } from '@/app/QlikReport/configs/dispatch.config';
import { dispatchReceiveConfig } from '@/app/QlikReport/configs/dispatchReceive.config';
import { dispatchLocationReceiveConfig } from '@/app/QlikReport/configs/dispatchLocationReceive.config';
import { salesOrderConfig } from '@/app/QlikReport/configs/salesOrder.config';
import { overallSalesConfig } from '@/app/QlikReport/configs/overallSales.config';
import { itemwiseSalesConfig } from '@/app/QlikReport/configs/itemwiseSales.config';
import { itemOrderConfig } from '@/app/QlikReport/configs/itemOrder.config';
import { cancelOrderConfig } from '@/app/QlikReport/configs/cancelOrder.config';
import { dayendConfig } from '@/app/QlikReport/configs/dayend.config';
import { itemTransferConfig } from '@/app/QlikReport/configs/itemTransfer.config';
import { wastageEntryConfig } from '@/app/QlikReport/configs/wastageEntry.config';
import { warehouseReturnConfig } from '@/app/QlikReport/configs/warehouseReturn.config';
import { cakeAppConfig } from '@/app/QlikReport/configs/cakeApp.config';
import { allRestaurantConfig } from '@/app/QlikReport/configs/allRestaurant.config';
import { paymodeConfig } from '@/app/QlikReport/configs/paymode.config';
import { purchaseConfig } from '@/app/QlikReport/configs/purchase.config';
import { itemDateWiseConfig } from '@/app/QlikReport/configs/itemDateWise.config';
import { grnAgainstConfig } from '@/app/QlikReport/configs/grnAgainst.config';
import { apInvoiceConfig } from '@/app/QlikReport/configs/apInvoice.config';
import { outgoingConfig } from '@/app/QlikReport/configs/outgoing.config';
import { outstandingConfig } from '@/app/QlikReport/configs/outstanding.config';
import { storeDispatchConfig } from '@/app/QlikReport/configs/storeDispatch.config';
import { debitNoteConfig } from '@/app/QlikReport/configs/debitNote.config';
import { debitNoteAmountConfig } from '@/app/QlikReport/configs/debitNoteAmount.config';
import { pettyCashExpenseConfig } from '@/app/QlikReport/configs/pettyCashExpense.config';
import { apInvoiceServiceConfig } from '@/app/QlikReport/configs/apInvoiceService.config'; // New Import
import { productionEntryConfig } from '@/app/QlikReport/configs/productionEntry.config';
import { createReportSlice } from '@/app/QlikReport/engine/genericSlice';
import { ReportState } from '@/app/QlikReport/engine/types';
import { Reducer } from '@reduxjs/toolkit';

export const productionEntryReport = createReportSlice(productionEntryConfig);
export const DispatchReport = createReportSlice(dispatchConfig);
export const DispatchReceiveReport = createReportSlice(dispatchReceiveConfig);
export const DispatchLocationReceiveReport = createReportSlice(dispatchLocationReceiveConfig);
export const SalesOrderReport = createReportSlice(salesOrderConfig);
export const OverallSalesReport = createReportSlice(overallSalesConfig);
export const ItemwiseSalesReport = createReportSlice(itemwiseSalesConfig);
export const ItemOrderReport = createReportSlice(itemOrderConfig);
export const CancelOrderReport = createReportSlice(cancelOrderConfig);
export const DayendReport = createReportSlice(dayendConfig);
export const ItemTransferReport = createReportSlice(itemTransferConfig);
export const WastageEntryReport = createReportSlice(wastageEntryConfig);
export const WarehouseReturnReport = createReportSlice(warehouseReturnConfig);
export const CakeAppReport = createReportSlice(cakeAppConfig);
export const AllRestaurantReport = createReportSlice(allRestaurantConfig);
export const PaymodeReport = createReportSlice(paymodeConfig);
export const PurchaseReport = createReportSlice(purchaseConfig);
export const ItemDateWiseReport = createReportSlice(itemDateWiseConfig);
export const GrnAgainstReport = createReportSlice(grnAgainstConfig);
export const ApInvoiceReport = createReportSlice(apInvoiceConfig);
export const OutgoingReport = createReportSlice(outgoingConfig);
export const OutstandingReport = createReportSlice(outstandingConfig);
export const StoreDispatchReport = createReportSlice(storeDispatchConfig);
export const DebitNoteReport = createReportSlice(debitNoteConfig);
export const DebitNoteAmountReport = createReportSlice(debitNoteAmountConfig);
export const PettyCashExpenseReport = createReportSlice(pettyCashExpenseConfig);
export const ApInvoiceServiceReport = createReportSlice(apInvoiceServiceConfig); // New Slice

export const reportReducers: {
  productionEntry: Reducer<ReportState>;
  dispatch: Reducer<ReportState>;
  dispatchReceive: Reducer<ReportState>;
  dispatchLocationReceive: Reducer<ReportState>;
  salesOrder: Reducer<ReportState>;
  overallSales: Reducer<ReportState>;
  itemwiseSales: Reducer<ReportState>;
  itemOrder: Reducer<ReportState>;
  cancelOrder: Reducer<ReportState>;
  dayend: Reducer<ReportState>;
  itemTransfer: Reducer<ReportState>;
  wastageEntry: Reducer<ReportState>;
  warehouseReturn: Reducer<ReportState>;
  cakeApp: Reducer<ReportState>;
  allRestaurant: Reducer<ReportState>;
  paymode: Reducer<ReportState>;
  purchase: Reducer<ReportState>;
  itemDateWise: Reducer<ReportState>;
  grnAgainst: Reducer<ReportState>;
  apInvoiceReport: Reducer<ReportState>;
  outgoing: Reducer<ReportState>;
  outstanding: Reducer<ReportState>;
  storeDispatch: Reducer<ReportState>;
  debitNote: Reducer<ReportState>;
  debitNoteAmount: Reducer<ReportState>;
  pettyCashExpense: Reducer<ReportState>;
  apInvoiceService: Reducer<ReportState>; // New Reducer
} = {
  productionEntry: productionEntryReport.slice.reducer,
  dispatch: DispatchReport.slice.reducer,
  dispatchReceive: DispatchReceiveReport.slice.reducer,
  dispatchLocationReceive: DispatchLocationReceiveReport.slice.reducer,
  salesOrder: SalesOrderReport.slice.reducer,
  overallSales: OverallSalesReport.slice.reducer,
  itemwiseSales: ItemwiseSalesReport.slice.reducer,
  itemOrder: ItemOrderReport.slice.reducer,
  cancelOrder: CancelOrderReport.slice.reducer,
  dayend: DayendReport.slice.reducer,
  itemTransfer: ItemTransferReport.slice.reducer,
  wastageEntry: WastageEntryReport.slice.reducer,
  warehouseReturn: WarehouseReturnReport.slice.reducer,
  cakeApp: CakeAppReport.slice.reducer,
  allRestaurant: AllRestaurantReport.slice.reducer,
  paymode: PaymodeReport.slice.reducer,
  purchase: PurchaseReport.slice.reducer,
  itemDateWise: ItemDateWiseReport.slice.reducer,
  grnAgainst: GrnAgainstReport.slice.reducer,
  apInvoiceReport: ApInvoiceReport.slice.reducer,
  outgoing: OutgoingReport.slice.reducer,
  outstanding: OutstandingReport.slice.reducer,
  storeDispatch: StoreDispatchReport.slice.reducer,
  debitNote: DebitNoteReport.slice.reducer,
  debitNoteAmount: DebitNoteAmountReport.slice.reducer,
  pettyCashExpense: PettyCashExpenseReport.slice.reducer,
  apInvoiceService: ApInvoiceServiceReport.slice.reducer, // Add here
};