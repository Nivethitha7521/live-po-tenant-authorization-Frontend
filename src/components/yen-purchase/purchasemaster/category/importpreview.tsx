'use client';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Typography,
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/redux/store';
import {
  fetchCategories,
  addCategory,
  setImportDialogOpen,
  setImportedData,
  setSnackbarMessage,
  setSnackbarOpen,
} from '@/features/yen-purchase/PurchaseMaster/PurchaseCategorySlice';

interface Category {
  purchasecategoryId: string;
  purchasecategoryName: string;
  status: string;
  randomId: string;
  subcategories: string[];
}

const ImportPreviewDialog = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { importedData, categories, importDialogOpen } = useSelector(
    (state: RootState) => state.purchaseCategory
  );

  const handleConfirmImport = () => {
    // Import each category, skipping duplicates
    const existingCategoryNames = categories.map((c) =>
      c.purchasecategoryName.toLowerCase()
    );
    const newCategories = importedData.filter(
      (data) =>
        !existingCategoryNames.includes(data.purchasecategoryName.toLowerCase())
    );

    if (newCategories.length === 0) {
      dispatch(setSnackbarMessage('No new categories to import'));
      dispatch(setSnackbarOpen(true));
      dispatch(setImportDialogOpen(false));
      dispatch(setImportedData([]));
      return;
    }

    Promise.all(newCategories.map((data) => dispatch(addCategory(data)).unwrap()))
      .then(() => {
        dispatch(setSnackbarMessage('Categories imported successfully'));
        dispatch(setSnackbarOpen(true));
        dispatch(setImportDialogOpen(false));
        dispatch(setImportedData([]));
        dispatch(fetchCategories());
      })
      .catch((error) => {
        dispatch(setSnackbarMessage(`Failed to import: ${error.message}`));
        dispatch(setSnackbarOpen(true));
      });
  };

  const handleClose = () => {
    dispatch(setImportDialogOpen(false));
    dispatch(setImportedData([]));
  };

  const existingCategoryNames = categories.map((c) =>
    c.purchasecategoryName.toLowerCase()
  );

  return (
    <Dialog open={importDialogOpen} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Import Purchase Categories</DialogTitle>
      <DialogContent>
        {importedData.length === 0 ? (
          <Typography>No data to display</Typography>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>categoryName</TableCell>
                <TableCell>Subcategories</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {importedData.map((row, index) => (
                <TableRow
                  key={index}
                  sx={{
                    backgroundColor: existingCategoryNames.includes(
                      row.purchasecategoryName.toLowerCase()
                    )
                      ? '#fff9c4' // Yellow for duplicates
                      : 'inherit',
                  }}
                >
                  <TableCell>{row.purchasecategoryName}</TableCell>
                  <TableCell>{row.subcategories.join(', ')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleConfirmImport}
          disabled={importedData.length === 0}
        >
          Import
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImportPreviewDialog;