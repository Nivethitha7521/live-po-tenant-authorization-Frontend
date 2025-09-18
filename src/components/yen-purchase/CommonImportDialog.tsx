'use client';
import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material';
import { ImportResult } from '@/Models/importResult';

const moduleConfig: Record<
  string,
  {
    entityName: string;
    idField: string;
    nameField: string;
    nameLabel: string;
    additionalFields?: Array<{ key: string; label: string }>;
  }
> = {
  category: {
    entityName: 'Category',
    idField: 'Category ID',
    nameField: 'Category Name', // Match backend response key
    nameLabel: 'Category Name',
    additionalFields: [{ key: 'Subcategories', label: 'Subcategories' }], // Match backend response key
  },
  subcategory: {
    entityName: 'Subcategory',
    idField: 'Subcategory ID',
    nameField: 'purchasesubcategoryName',
    nameLabel: 'Subcategory Name',
  },
  itemType: {
    entityName: 'Item Type',
    idField: 'randomId',
    nameField: 'itemtypeName',
    nameLabel: 'Item Type Name',
  },
  itemGroup: {
    entityName: 'Item Group',
    idField: 'randomId',
    nameField: 'itemgroupName',
    nameLabel: 'Item Group Name',
  },
  storagelocation: {
    entityName: 'Storage Location',
    idField: 'Storage Location ID',
    nameField: 'locationName',
    nameLabel: 'Storage Location Name',
  },
  purchaseItem: {
    entityName: 'Purchase Item',
    idField: 'Item ID',
    nameField: 'itemName',
    nameLabel: 'Item Name',
    additionalFields: [
      { key: 'purchasecategoryName', label: 'Category' },
      { key: 'purchasesubcategoryName', label: 'Subcategory' },
    ],
  },
  vendor: {
    entityName: 'Vendor',
    idField: 'Vendor ID',
    nameField: 'vendorName',
    nameLabel: 'Vendor Name',
    additionalFields: [
      { key: 'contactpersonPhone', label: 'Contact Phone' },
      { key: 'existingId', label: 'Existing Vendor ID' },
    ],
  },
};

interface CommonImportResultDialogProps {
  open: boolean;
  onClose: () => void;
  importResult: ImportResult | null;
  module: string;
}

const CommonImportResultDialog: React.FC<CommonImportResultDialogProps> = ({
  open,
  onClose,
  importResult,
  module,
}) => {
  const config = moduleConfig[module] || {
    entityName: module.charAt(0).toUpperCase() + module.slice(1),
    idField: 'ID',
    nameField: 'name',
    nameLabel: 'Name',
  };
  const { entityName, idField, nameField, nameLabel, additionalFields = [] } = config;

  if (!importResult) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>{entityName} CSV Import Results</DialogTitle>
        <DialogContent>
          <DialogContentText>No import results available.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="primary" variant="contained" autoFocus>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  const {
    message = 'No message provided',
    inserted_count = 0,
    updated_count = 0,
    successful = [],
    updated = [],
    failed = [],
    errorCount = 0,
    detail,
  } = importResult;

  const isError = !!detail && !!detail.message && !inserted_count && !updated_count;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{entityName} CSV Import Results</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {isError ? (
            <Typography color="error">
              Import failed: {detail?.message}
              {detail?.missing && (
                <ul>
                  {detail.missing.map((header, index) => (
                    <li key={index}>Missing header: {header}</li>
                  ))}
                </ul>
              )}
            </Typography>
          ) : (
            <>
              <Typography variant="body1" gutterBottom>
                {message}
              </Typography>
              <Typography variant="body2">New {entityName}s Added: {inserted_count}</Typography>
              <Typography variant="body2">Existing {entityName}s Updated: {updated_count}</Typography>
              {errorCount > 0 && (
                <Typography variant="body2" color="error">
                  Errors Encountered: {errorCount}
                </Typography>
              )}
            </>
          )}
        </DialogContentText>
        {!isError && successful.length > 0 && (
          <>
            <Typography variant="subtitle1" sx={{ mt: 2, color: '#2e7d32' }} gutterBottom>
              Successfully Imported {entityName}s
            </Typography>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Row</TableCell>
                  <TableCell>{idField}</TableCell>
                  <TableCell>{nameLabel}</TableCell>
                  {additionalFields.map((field) => (
                    <TableCell key={field.key}>{field.label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {successful.map((success, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{success.row}</TableCell>
                    <TableCell>{success.data[idField] || 'N/A'}</TableCell>
                    <TableCell>{success.data[nameField] || 'N/A'}</TableCell>
                    {additionalFields.map((field) => (
                      <TableCell key={field.key}>{success.data[field.key] || 'N/A'}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
        {!isError && updated.length > 0 && (
          <>
            <Typography variant="subtitle1" sx={{ mt: 2, color: '#d4a017' }} gutterBottom>
              Updated {entityName}s
            </Typography>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Row</TableCell>
                  <TableCell>{idField}</TableCell>
                  <TableCell>{nameLabel}</TableCell>
                  {additionalFields.map((field) => (
                    <TableCell key={field.key}>{field.label}</TableCell>
                  ))}
                  <TableCell>Reason</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {updated.map((dup, idx) => (
                  <TableRow key={idx} sx={{ backgroundColor: '#fff9e6' }}>
                    <TableCell>{dup.row}</TableCell>
                    <TableCell>{dup.data[idField] || 'N/A'}</TableCell>
                    <TableCell>{dup.data[nameField] || 'N/A'}</TableCell>
                    {additionalFields.map((field) => (
                      <TableCell key={field.key}>{dup.data[field.key] || 'N/A'}</TableCell>
                    ))}
                    <TableCell>{dup.Reason || `Duplicate ${entityName.toLowerCase()} updated`}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
        {!isError && failed.length > 0 && (
          <>
            <Typography variant="subtitle1" color="error" gutterBottom sx={{ mt: 2 }}>
              Failed Imports
            </Typography>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Row</TableCell>
                  <TableCell>{nameLabel}</TableCell>
                  {additionalFields.map((field) => (
                    <TableCell key={field.key}>{field.label}</TableCell>
                  ))}
                  <TableCell>Error</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {failed.map((error, idx) => (
                  <TableRow key={idx} sx={{ backgroundColor: '#ffe6e6' }}>
                    <TableCell>{error.row}</TableCell>
                    <TableCell>{error.data[nameField] || 'N/A'}</TableCell>
                    {additionalFields.map((field) => (
                      <TableCell key={field.key}>{error.data[field.key] || 'N/A'}</TableCell>
                    ))}
                    <TableCell>
                      {error.error}
                      {error.missingFields && error.missingFields.length > 0 && ` (Missing: ${error.missingFields.join(', ')})`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
        {isError && (
          <Typography variant="body1" sx={{ mt: 2 }}>
            No results to display due to import failure.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" variant="contained" autoFocus>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CommonImportResultDialog;