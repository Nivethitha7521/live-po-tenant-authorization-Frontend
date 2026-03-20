// engine/ReportPage.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RootState } from '@/redux/store';

import { ReportConfig, ReportState } from './types';
import { createReportSlice } from './genericSlice';
import { useReportLogic } from './useReportLogic';

import GenericTableHeader from '../components/GenericTableHeader';
import GenericDataTable from '../components/GenericDataTable';
import GenericColumnFilterPanel from '../components/GenericColumnFilterPanel';
import GenericFullscreenView from '../components/GenericFullscreenView';
import GlobalSnackbar from '@/glopals/GlobalSnackbar';
import GenericFilterSection from '../components/GenericFilterSection';

type ReportSliceReturn = ReturnType<typeof createReportSlice>;

interface ReportPageProps {
  config: ReportConfig;
  thunks: ReportSliceReturn['thunks'];
  actions: ReportSliceReturn['slice']['actions'];
  selector: (state: RootState) => ReportState;
}

function ReportPageInner({
  config,
  thunks,
  actions,
  selector,
}: ReportPageProps) {
  const logic = useReportLogic({ config, thunks, selector, actions });
  const { state, dispatch ,isLoading} = logic;

  const [showColumnFilter, setShowColumnFilter] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    () => config?.columns?.map((c) => c.displayKey) || []
  );

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100 && !state.paginationLoading && logic.hasMore) {
          logic.fetchNext();
        }
        ticking = false;
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [logic.fetchNext, state.paginationLoading, logic.hasMore]);

  const handleToggleColumn = (colKey: string) => {
    setVisibleColumns((prev) => {
      if (prev.includes(colKey)) return prev.filter((c) => c !== colKey);
      return config.columns.map((c) => c.displayKey).filter((k) => [...prev, colKey].includes(k));
    });
  };

  const exportToPDF = () => {
    try {
      if (visibleColumns.length > 12) {
        dispatch(actions.setSnackbar({ message: 'Maximum 12 columns allowed for PDF export.', severity: 'warning' }));
        return;
      }
      if (!state.items.length) {
        dispatch(actions.setSnackbar({ message: 'No data to export – the table is empty.', severity: 'warning' }));
        return;
      }
      const head = [visibleColumns.map((k) => config.columns.find((c) => c.displayKey === k)?.label ?? k)];
      const body = (state.items as unknown[]).map((row) =>
        visibleColumns.map((k) => {
          const col = config.columns.find((c) => c.displayKey === k);
          return col ? String((row as Record<string, unknown>)[col.dataKey as string] ?? '') : '';
        })
      );
      const doc = new jsPDF('l', 'pt', 'a4');
      autoTable(doc, {
        head, body,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [22, 160, 133] },
        margin: { top: 30 },
        didDrawPage: () => {
          doc.setFontSize(10);
          doc.text(`${config.title}`, 40, 20);
        },
      });
      const prefix = config.exportFilename ?? config.title.replace(/\s+/g, '');
      doc.save(`${prefix}_YenERP_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err: unknown) {
      let msg = 'PDF export failed';
      if (err instanceof Error) msg += ': ' + err.message;
      dispatch(actions.setSnackbar({ message: msg, severity: 'error' }));
    }
  };

  const commonProps = {
    config,
    state,
    visibleColumns,
    onFilterChange: logic.handleFilterChange,
    onClear: logic.handleClear,
    onSearch: logic.handleSearch,
    onDropdownSearch: logic.handleDropdownSearch,
    onLoadMoreDropdown: logic.handleLoadMoreDropdown,
    onExportExcel: logic.handleExportExcel,
    onExportPDF: exportToPDF,
    containerRef,
    filtersDirty: logic.filtersDirty,
    exporting: state.exporting,
  };

  if (isFullscreen) {
    return (
      <GenericFullscreenView
        {...commonProps}
        onExitFullscreen={() => setIsFullscreen(false)}
        snackbarOpen={state.snackbar.open}
        snackbarMessage={state.snackbar.message}
        snackbarSeverity={state.snackbar.severity}
        onSnackbarClose={() => dispatch(actions.clearSnackbar())}
      />
    );
  }

  return (
    <>
      <Box className="p-1 bg-white h-full flex flex-col overflow-hidden">
        <GenericTableHeader
          title={config.title}
          exporting={state.exporting}
          isAnyFilterSelected={logic.isAnyFilterSelected}
          onExportExcel={logic.handleExportExcel}
          onExportPDF={exportToPDF}
          onToggleColumnFilter={() => setShowColumnFilter((v) => !v)}
          onToggleFullscreen={() => setIsFullscreen(true)}
        />
        
        <GenericFilterSection {...commonProps} />
        
        {showColumnFilter && (
          <GenericColumnFilterPanel
            config={config}
            visibleColumns={visibleColumns}
            onToggleColumn={handleToggleColumn}
          />
        )}

        {/* UPDATED: Removed the state.loading conditional branch. 
            The table now stays mounted and displays its own internal 
            Qlik-style loading overlay via the isLoading prop.
        */}
        <Box className="flex-1 relative overflow-hidden">
          {state.error ? (
            <Box className="h-full flex items-center justify-center text-red-600 bg-red-50">
              {String(state.error)}
            </Box>
          ) : (
            <GenericDataTable
              ref={containerRef}
              config={config}
              data={state.items as Record<string, unknown>[]}
              visibleColumns={visibleColumns}
             isLoading={isLoading} // Triggers the Qlik-style load icon
            />
          )}
        </Box>
      </Box>

      <GlobalSnackbar
        open={state.snackbar.open}
        message={state.snackbar.message}
        severity={state.snackbar.severity}
        onClose={() => dispatch(actions.clearSnackbar())}
      />
    </>
  );
}

export const ReportPage = React.memo(ReportPageInner) as typeof ReportPageInner;
export default ReportPage;