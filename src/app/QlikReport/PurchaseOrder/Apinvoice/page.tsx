'use client';

import { ApInvoiceReport } from '@/redux/reportRegistry';
import { RootState } from '@/redux/store';
import ReportPage from '@/app/QlikReport/engine/ReportPage';
import { apInvoiceConfig } from '../../configs/apInvoice.config'; // Adjust path if needed

// This selector uses the 'key' from your config (key: 'apInvoice')
const selector = (s: RootState) => s.apInvoiceReport;

export default function ApInvoicePage() {
  return (
    <ReportPage
      config={apInvoiceConfig}
      thunks={ApInvoiceReport.thunks}
      actions={ApInvoiceReport.slice.actions}
      selector={selector}
    />
  );
}