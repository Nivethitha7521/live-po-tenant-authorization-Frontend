"use client";
import React, { useState } from "react";
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
  TableContainer,
  Paper,
  Typography,
  Divider,
  Box,
} from "@mui/material";

interface Change {
  itemName: string;
  varianceName: string;
  locationId: string;
  newValue: number;
  itemCode: string;
}

interface ConfirmDialogProps {
  open: boolean;
  totalItems: number;
  changes: Change[];
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  totalItems,
  changes,
  onClose,
  onConfirm,
}) => {
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false); // remove this line if you want button to stay disabled after confirming
    }
  };

  return (
    <>


      <Dialog
        open={open}
        onClose={onClose}
        BackdropProps={{
          sx: {
            backdropFilter: "blur(6px)",          // background blur
            WebkitBackdropFilter: "blur(6px)",   // Safari support
            backgroundColor: "rgba(0,0,0,0.25)", // semi-transparent overlay
          },
        }}
        PaperProps={{
          sx: {
            width: 500,
            maxWidth: "90%",
            borderRadius: 3,
            overflow: "hidden",
            bgcolor: "rgba(255,255,255,0.8)", // frosted glass effect
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          },
        }}
      >
        <DialogTitle sx={{ textAlign: "center", fontWeight: 800 }}>
          Confirm Submission
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ padding: 3 }}>
          {changes.length > 0 && (
            <TableContainer
              component={Paper}
              sx={{
                mt: 1,
                maxHeight: 260,
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
                overflow: "auto",
              }}
            >
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    {["Item Code", "Variance", "Location", "New Stock"].map(
                      (label) => (
                        <TableCell
                          key={label}
                          align="center"
                          sx={{
                            fontWeight: 700,
                            bgcolor: "background.default",
                            color: "text.primary",
                          }}
                        >
                          {label}
                        </TableCell>
                      )
                    )}
                  </TableRow>
                </TableHead>

                <TableBody>
                  {changes.map((change, index) => (
                    <TableRow
                      key={`${change.itemName}-${change.varianceName}-${change.locationId}-${index}`}
                      hover
                    >
                      <TableCell align="center">{change.itemCode}</TableCell>
                      <TableCell align="center">{change.varianceName}</TableCell>
                      <TableCell align="center">{change.locationId}</TableCell>
                      <TableCell align="center">{change.newValue}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Box
            sx={{
              mt: 2,
              display: "flex",
              justifyContent: "space-between",
              gap: 2,
              p: 2,
              borderRadius: 2,
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Total Items
            </Typography>
            <Typography variant="body1" fontWeight={700}>
              {totalItems}
            </Typography>

            <Typography variant="body2" color="text.secondary">
              Edited Items
            </Typography>
            <Typography variant="body1" fontWeight={700}>
              {changes.length}
            </Typography>
          </Box>

          <Typography sx={{ mt: 2, fontWeight: 700 }}>
            Are you sure you want to submit the changes?
          </Typography>
        </DialogContent>

        <DialogActions sx={{ justifyContent: "center", pb: 2, px: 3 }}>
          <Button
            onClick={onClose}
            variant="outlined"
            sx={{ borderRadius: 2 }}
            disabled={confirming}
          >
            Cancel
          </Button>

          <Button
            onClick={handleConfirm}
            variant="contained"
            sx={{ borderRadius: 2, px: 4 }}
            disabled={confirming}
          >
            {confirming ? "Processing..." : "Confirm"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ConfirmDialog;
