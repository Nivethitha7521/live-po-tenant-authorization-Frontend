import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, FormControl, InputLabel, Select, MenuItem, TextField } from '@mui/material';

// Define types for the props
interface PaymentMethodDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirmPayment: () => void;
  paymentType: string;
  setPaymentType: React.Dispatch<React.SetStateAction<string>>;
  paymentField: string;
  setPaymentField: React.Dispatch<React.SetStateAction<string>>;
}

const PaymentMethodDialog: React.FC<PaymentMethodDialogProps> = ({
  open,
  onClose,
  onConfirmPayment,
  paymentType,
  setPaymentType,
  paymentField,
  setPaymentField
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Select Payment Method</DialogTitle>
      <DialogContent>
        <FormControl fullWidth>
          <InputLabel id="payment-type-label">Payment Method</InputLabel>
          <Select
            labelId="payment-type-label"
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value)}
            label="Payment Method"
          >
            <MenuItem value="cash">Cash</MenuItem>
            <MenuItem value="cheque">Cheque</MenuItem>
            <MenuItem value="rtgs">RTGS</MenuItem>
            <MenuItem value="neft">NEFT</MenuItem>
          </Select>
        </FormControl>

        {paymentType === 'cash' && (
          <TextField
            label="Cash Voucher Number"
            value={paymentField}
            onChange={(e) => setPaymentField(e.target.value)}
            fullWidth
            style={{ marginTop: 10 }}
          />
        )}
        {paymentType === 'cheque' && (
          <TextField
            label="Cheque Number"
            value={paymentField}
            onChange={(e) => setPaymentField(e.target.value)}
            fullWidth
            style={{ marginTop: 10 }}
          />
        )}
        {paymentType === 'rtgs' && (
          <TextField
            label="RTGS Number"
            value={paymentField}
            onChange={(e) => setPaymentField(e.target.value)}
            fullWidth
            style={{ marginTop: 10 }}
          />
        )}
        {paymentType === 'neft' && (
          <TextField
            label="NEFT Number"
            value={paymentField}
            onChange={(e) => setPaymentField(e.target.value)}
            fullWidth
            style={{ marginTop: 10 }}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained" color="primary">Cancel</Button>
        <Button onClick={onConfirmPayment} variant="contained" color="primary">
          Confirm Payment
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PaymentMethodDialog;
