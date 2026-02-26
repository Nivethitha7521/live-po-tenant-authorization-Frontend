import { Dialog, DialogTitle, DialogContent, TextField, DialogActions } from "@mui/material";
import { Button } from "react-bootstrap";
import React from "react";  // You need to import React for functional components if not using JSX runtime

// Define the correct props for ItemGroupDialog
interface ItemGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  editIndex: number | null;
  purchaseGroupItemData: any;
  handleInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const ItemGroupDialog: React.FC<ItemGroupDialogProps> = ({
  open,
  onClose,
  onSave,
  editIndex,
  purchaseGroupItemData,
  handleInputChange
}) => (
  <Dialog open={open} onClose={onClose}>
    <DialogTitle>
      {editIndex !== null ? "Edit Purchase Group Item" : "Add New Purchase Group Item"}
    </DialogTitle>
    <DialogContent>
      <TextField
        autoFocus
        margin="dense"
        id="itemgroupName"
        name="itemgroupName"
        label="Item Group Name"
        type="text"
        fullWidth
        variant="outlined"
        value={purchaseGroupItemData.itemgroupName}
        onChange={handleInputChange}
      />
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} variant="primary">
        Cancel
      </Button>
      <Button onClick={onSave} variant="primary">
        {editIndex !== null ? "Update" : "Add"}
      </Button>
    </DialogActions>
  </Dialog>
);

export default ItemGroupDialog;
