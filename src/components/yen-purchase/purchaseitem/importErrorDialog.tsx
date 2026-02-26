// components/yen-purchase/purchaseitem/importErrorDialog.tsx
import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody
} from '@mui/material';
import { FixedSizeList } from 'react-window';

interface ImportErrorDialogProps {
  open: boolean;
  onClose: () => void;
  importResults: {
    successful: Array<{ row: number; data: Record<string, string> }>;
    updated: Array<{ row: number; data: Record<string, string>; error?: string }>;
    failed: Array<{ row: number; data: Record<string, string>; error: string; missingFields: string[] }>;
  };
}

const ImportErrorDialog: React.FC<ImportErrorDialogProps> = ({ open, onClose, importResults }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>CSV Import Results</DialogTitle>
      <DialogContent>
        {importResults.failed.length > 0 && (
          <>
            <Typography variant="subtitle1" color="error" gutterBottom>
              Missing Required Fields or Errors
            </Typography>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Row</TableCell>
                  <TableCell>Error</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {importResults.failed.map((error, idx) => (
                  <TableRow key={idx} sx={{ backgroundColor: '#ffe6e6' }}>
                    <TableCell>{error.row}</TableCell>
                    <TableCell>
                      {error.error}
                      {error.missingFields?.length > 0 && ` (Missing: ${error.missingFields.join(', ')})`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
        {importResults.updated.length > 0 && (
          <>
            <Typography variant="subtitle1" sx={{ mt: 2, color: '#d4a017' }} gutterBottom>
              Duplicates (Updated)
            </Typography>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Row</TableCell>
                  <TableCell>Item Name</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Reason</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {importResults.updated.map((dup, idx) => (
                  <TableRow key={idx} sx={{ backgroundColor: '#fff9e6' }}>
                    <TableCell>{dup.row}</TableCell>
                    <TableCell>{dup.data.itemName}</TableCell>
                    <TableCell>{dup.data.purchasecategoryName}</TableCell>
                    <TableCell>{dup.error || 'Duplicate item'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
        {importResults.failed.length === 0 && importResults.updated.length === 0 && (
          <Typography variant="body1">No issues found during import.</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImportErrorDialog;