{/*/ import { ALL_COLUMNS } from '../constants/tableConstants';
import { Poreport } from '../Models/Model';



// Auto column width: minimum 120px, expand automatically
export const calculateColumnWidths = (data: Poreport[], visibleColumns: string[]) => {
  const widths: { [key: string]: number } = {};
  
  visibleColumns.forEach((columnKey) => {
    const column = ALL_COLUMNS.find((c) => c.displayKey === columnKey);
    if (!column) return;
    
    // Start with header length
    let maxLength = column.label.length;
    
    // Check all data rows
    data.forEach((row) => {
      const value = formatValue(row[column.dataKey]);
      maxLength = Math.max(maxLength, value.length);
    });
    
    // Convert character length to pixels (rough estimate: 8px per char)
    // Add padding and set min/max bounds
    const calculatedWidth = Math.max(100, Math.min(400, maxLength * 8 + 32));
    widths[columnKey] = calculatedWidth;
  });
  
  return widths;
};

export const toOptions = (arr?: (string | number)[]) =>
  (arr ?? []).map((v) => ({ value: String(v), label: String(v) }));

export const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === 0 || value === '') return '-';
  return String(value);
};



/*/ }  