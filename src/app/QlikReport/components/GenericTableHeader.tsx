'use client';

import React from 'react';
import { Box, Tooltip, IconButton, Divider, Badge } from '@mui/material';
import { 
  HiOutlineAdjustmentsHorizontal, 
  HiOutlineArrowsPointingOut,
  HiOutlineArrowDownTray 
} from 'react-icons/hi2'; // Modern, thin-stroke icons
import { RiFileExcel2Line, RiFilePdfLine } from 'react-icons/ri';

interface GenericTableHeaderProps {
  title: string;
  exporting: boolean;
  isAnyFilterSelected: boolean;
  onExportExcel: () => void;
  onExportPDF: () => void;
  onToggleColumnFilter: () => void;
  onToggleFullscreen: () => void;
}

export const GenericTableHeader: React.FC<GenericTableHeaderProps> = ({
  title,
  exporting,
  isAnyFilterSelected,
  onExportExcel,
  onExportPDF,
  onToggleColumnFilter,
  onToggleFullscreen,
}) => (
  <Box className="flex flex-col sm:flex-row justify-between items-center px-5 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-10">
    
    {/* Left Side: Contextual Title */}
    <div className="flex items-center space-x-4">
      <div className="flex flex-col">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight leading-none">
          {title}
        </h2>
        <span className="text-[11px] text-slate-500 uppercase tracking-widest font-medium mt-1">
          Management Console
        </span>
      </div>
    </div>

    {/* Right Side: Toolset */}
    <div className="flex items-center gap-x-3 mt-4 sm:mt-0">
      
      {/* Export Grouping */}
      <div className="flex items-center self-stretch bg-slate-50/50 border border-slate-200 rounded-lg px-1 py-1">
        <Tooltip title="Download Excel" arrow>
          <button
            onClick={onExportExcel}
            disabled={exporting}
            className="p-2 text-slate-600 hover:text-emerald-600 hover:bg-white rounded-md transition-all duration-200 disabled:opacity-30"
          >
            <RiFileExcel2Line size={19} />
          </button>
        </Tooltip>
        
        <div className="w-[1px] h-4 bg-slate-300 mx-1" />

        <Tooltip title="Download PDF" arrow>
          <button
            onClick={onExportPDF}
            className="p-2 text-slate-600 hover:text-rose-600 hover:bg-white rounded-md transition-all duration-200"
          >
            <RiFilePdfLine size={19} />
          </button>
        </Tooltip>
      </div>

      {/* Primary Action: Filter */}
      <button
        onClick={onToggleColumnFilter}
        className={`
          group relative flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition-all duration-300
          ${isAnyFilterSelected 
            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' 
            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 shadow-sm'}
        `}
      >
        <HiOutlineAdjustmentsHorizontal 
          className={`text-lg transition-transform group-hover:rotate-180 duration-500 ${isAnyFilterSelected ? 'text-indigo-600' : 'text-slate-500'}`} 
        />
        <span>View Filters</span>
        
        {isAnyFilterSelected && (
          <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-pulse ml-1" />
        )}
      </button>

      {/* Utility: Fullscreen */}
      <Tooltip title="Expand View">
        <button
          onClick={onToggleFullscreen}
          className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-200 rounded-lg transition-all"
        >
          <HiOutlineArrowsPointingOut size={20} />
        </button>
      </Tooltip>
      
    </div>
  </Box>
);

export default GenericTableHeader;