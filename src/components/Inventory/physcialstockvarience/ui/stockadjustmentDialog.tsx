import { Branchitem } from "@/features/yen_inventory/OutletPhysicalVarianceSlice";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from "@mui/material";

interface StockAdjustmentDialogProps {
  open: boolean;
  item: Branchitem | null;
  adjustedPhysicalStock: string;
  adjustmentReason: string;
  onClose: (confirm: boolean) => void;
  onChangePhysicalStock: (value: string) => void;
  onChangeReason: (value: string) => void;
  fullScreen: boolean;
}

export const StockAdjustmentDialog: React.FC<StockAdjustmentDialogProps> = ({
  open,
  item,
  adjustedPhysicalStock,
  adjustmentReason,
  onClose,
  onChangePhysicalStock,
  onChangeReason,
  fullScreen,
}) => {
  return (
    <Dialog
      open={open}
      onClose={() => onClose(false)}
      fullScreen={fullScreen}
      sx={fullScreen ? { zIndex: 10000 } : {}}
    >
      <DialogTitle>Adjust Stock for {item?.itemName}</DialogTitle>
      <DialogContent>
        <TextField
          label="Current System Quantity"
          value={item?.physicalStock || ""}
          disabled
          fullWidth
          margin="dense"
        />
        <TextField
          label="Physical Stock"
          value={adjustedPhysicalStock}
          onChange={(e) => onChangePhysicalStock(e.target.value)}
          fullWidth
          margin="dense"
          type="number"
        />
        <TextField
          label="Reason for Adjustment"
          value={adjustmentReason}
          onChange={(e) => onChangeReason(e.target.value)}
          fullWidth
          margin="dense"
          multiline
          rows={3}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)}>Cancel</Button>
        <Button
          onClick={() => onClose(true)}
          disabled={!adjustmentReason || !adjustedPhysicalStock}
        >
          Approve
        </Button>
      </DialogActions>
    </Dialog>
  );
};