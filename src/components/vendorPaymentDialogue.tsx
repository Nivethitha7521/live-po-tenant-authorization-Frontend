import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography } from '@mui/material';

interface Outgoing {
  outgoingId: string;
  invoiceNo: string;
  invoiceDate: string;
  grnId: string;
  totalPayableAmount: number;
  itemDetails?: string; // optional or required field depending on your needs
  vendorName?: string; // Add vendorName if needed
}

interface VendorPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  onProcessPayment: () => void;
  selectedOutgoings: Outgoing[];
  groupedOutgoingsByVendor: (outgoings: Outgoing[]) => { [vendorName: string]: Outgoing[] };
  getRandomId: (id: string) => string;
}

const VendorPaymentDialog: React.FC<VendorPaymentDialogProps> = ({
  open,
  onClose,
  onProcessPayment,
  selectedOutgoings,
  groupedOutgoingsByVendor,
  getRandomId
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Confirm Payment for Selected Vendors</DialogTitle>
      <DialogContent>
        {selectedOutgoings.length === 0 ? (
          <Typography>No Vendors selected</Typography>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Vendor Name</TableCell>
                  <TableCell>Invoice No</TableCell>
                  <TableCell>Invoice Date</TableCell>
                  <TableCell>GRN No</TableCell>
                  <TableCell>Total Payable Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(groupedOutgoingsByVendor(selectedOutgoings)).map(([vendorName, outgoings]) => (
                  <React.Fragment key={vendorName}>
                    {outgoings.map((outgoing, index) => (
                      <TableRow key={outgoing.outgoingId}>
                        {index === 0 && <TableCell rowSpan={outgoings.length}>{vendorName}</TableCell>}
                        <TableCell>{outgoing.invoiceNo}</TableCell>
                        <TableCell>{outgoing.invoiceDate}</TableCell>
                        <TableCell>{getRandomId(outgoing.grnId)}</TableCell>
                        <TableCell>{outgoing.totalPayableAmount}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={4} align="right"><strong>Total for {vendorName}:</strong></TableCell>
                      <TableCell>
                        <strong>
                          {outgoings.reduce((sum, outgoing) => sum + (outgoing.totalPayableAmount ?? 0), 0)}
                        </strong>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained" color="primary">Cancel</Button>
        <Button onClick={onProcessPayment} variant="contained" color="primary">
          Process Payment
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VendorPaymentDialog;
