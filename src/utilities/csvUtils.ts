import Papa from 'papaparse';
import { saveAs } from 'file-saver';

interface CsvHeaders {
  label: string;
  key: string;
}

export const importCsv = (file: File, callback: (data: any[]) => void) => {
  Papa.parse(file, {
    header: true,
    complete: (results) => {
      callback(results.data);
    },
  });
};

export const exportCsv = (data: any[], headers: CsvHeaders[], filename: string) => {
  const csv = Papa.unparse(data, {
    header: true,  // Enables headers in the CSV
    columns: headers.map(h => h.key)  // Map 'key' to use as the column names in the CSV
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, filename);
};
