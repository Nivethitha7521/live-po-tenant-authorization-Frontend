'use client';
 
import {  productionEntryReport }  from '@/redux/reportRegistry';
import { RootState }              from '@/redux/store';
import ReportPage from '@/app/QlikReport/engine/ReportPage';
import { productionEntryConfig } from '@/app/QlikReport/configs/productionEntry.config';
 
// FIX: Select 'productionEntry' (the key defined in your config)
// This matches the state created by reportReducers in store.ts
const selector = (s: RootState) => s.productionEntry;
 
export default function ProductionEntryPage() {
  return (
    <ReportPage
      config={productionEntryConfig}
      thunks={productionEntryReport.thunks}
      actions={productionEntryReport.slice.actions}
      selector={selector}
    />
  );
}