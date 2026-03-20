'use client';

import React from 'react';
import { Box, Tooltip, Divider } from '@mui/material';
import { 
  HiOutlineArrowsPointingIn, 
  HiOutlineDocumentArrowDown 
} from 'react-icons/hi2';
import { RiFileExcel2Line, RiFilePdfLine } from 'react-icons/ri';
import GenericDataTable from './GenericDataTable';
import GlobalSnackbar from '@/glopals/GlobalSnackbar';
import { ReportConfig, ReportState } from '../engine/types';

interface GenericFullscreenViewProps<T = Record<string, unknown>> {
  config: ReportConfig<T>;
  state: ReportState<T>;
  visibleColumns: string[];
  exporting: boolean;
  onExportExcel: () => void;
  onExportPDF: () => void;
  onExitFullscreen: () => void;
  containerRef: React.RefObject<HTMLDivElement>;
  snackbarOpen: boolean;
  snackbarMessage: string;
  snackbarSeverity: 'success' | 'error' | 'warning' | 'info';
  onSnackbarClose: () => void;
}

export const GenericFullscreenView = <T,>({
  config,
  state,
  visibleColumns,
  exporting,
  onExportExcel,
  onExportPDF,
  onExitFullscreen,
  containerRef,
  snackbarOpen,
  snackbarMessage,
  snackbarSeverity,
  onSnackbarClose,
}: GenericFullscreenViewProps<T>) => (
  <>
    <Box className="fixed inset-0 z-[100] bg-slate-50 flex flex-col h-screen w-screen overflow-hidden">
      
      {/* High-End Toolset Header */}
      <Box className="flex justify-between items-center px-6 py-3 bg-white border-b border-slate-200 shadow-sm z-10">
        
        {/* Left: Breadcrumb-style Title */}
        <Box className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600">
            <HiOutlineDocumentArrowDown size={20} />
          </div>
          <div className="flex flex-col">
            <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider leading-none">
              Viewing Mode
            </h2>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {config.title} <span className="text-slate-400 font-light mx-1">/</span> Full Report
            </h1>
          </div>
        </Box>

        {/* Right: Actions */}
        <Box className="flex items-center gap-3">
          
          {/* Export Group */}
          <div className="flex items-center bg-slate-100/80 border border-slate-200 rounded-xl p-1">
            <Tooltip title="Export to Excel" arrow>
              <button
                onClick={onExportExcel}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white hover:text-green-700 text-slate-600 transition-all duration-200 disabled:opacity-30 font-semibold text-sm"
              >
                <RiFileExcel2Line size={18} className="text-green-600" />
                <span>Excel</span>
              </button>
            </Tooltip>

            <div className="w-px h-6 bg-slate-300 mx-1" />

            <Tooltip title="Export to PDF" arrow>
              <button
                onClick={onExportPDF}
                className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white hover:text-red-700 text-slate-600 transition-all duration-200 font-semibold text-sm"
              >
                <RiFilePdfLine size={18} className="text-red-600" />
                <span>PDF</span>
              </button>
            </Tooltip>
          </div>

          <Divider orientation="vertical" flexItem className="mx-2" />

          {/* Exit Fullscreen */}
          <button
            onClick={onExitFullscreen}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-lg shadow-slate-200 transition-all active:scale-95"
          >
            <HiOutlineArrowsPointingIn size={18} />
            <span>Close View</span>
          </button>
        </Box>
      </Box>

      {/* Main Table Content */}
      <Box className="flex-1 overflow-auto p-4 md:p-6 bg-slate-50/50">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden h-full">
          <GenericDataTable
            ref={containerRef}
            config={config}
            data={state.items as Record<string, unknown>[]}
            visibleColumns={visibleColumns}
          />
        </div>
      </Box>
    </Box>

    <GlobalSnackbar
      open={snackbarOpen}
      message={snackbarMessage}
      severity={snackbarSeverity}
      onClose={onSnackbarClose}
    />
  </>
);

export default GenericFullscreenView;