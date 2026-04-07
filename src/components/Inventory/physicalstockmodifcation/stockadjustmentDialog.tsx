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
  onConfirm?: () => void;
  onCancel: () => void;
  onChangePhysicalStock: (value: string) => void;
  onChangeReason: (value: string) => void;
  fullScreen: boolean;
}
export const StockAdjustmentDialog: React.FC<StockAdjustmentDialogProps> = ({
  open,
  item,
  adjustedPhysicalStock,
  adjustmentReason,
  onConfirm,
  onCancel,
  onChangePhysicalStock,
  onChangeReason,
  fullScreen,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onCancel}   // ❗ no confirm logic here
      fullScreen={fullScreen}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          height: fullScreen ? "100%" : "80vh",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <DialogTitle>
        Adjust Stock for {item?.itemName}
      </DialogTitle>

      <DialogContent
        sx={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <TextField
          label="Current System Quantity"
          value={item?.currentSystemQty || ""}
          disabled
          fullWidth
          margin="dense"
        />

        <TextField
          label="Physical Stock"
          type="number"
          value={adjustedPhysicalStock}
          onChange={(e) => onChangePhysicalStock(e.target.value)}
          fullWidth
          margin="dense"
        />

        <TextField
          label="Reason for Adjustment"
          value={adjustmentReason}
          onChange={(e) => onChangeReason(e.target.value)}
          fullWidth
          margin="dense"
          multiline
          rows={6}
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={onCancel}>
          Cancel
        </Button>

        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={!adjustmentReason || !adjustedPhysicalStock}
        >
          Approve
        </Button>
      </DialogActions>
    </Dialog>
  );
};
