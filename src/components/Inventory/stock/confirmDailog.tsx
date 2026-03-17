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
  Box,
  Divider,
} from "@mui/material";

interface Change {
  itemName: string;
  varianceName: string;
  randomId: string;
  locationId?: string;
  newValue: number;
}

interface ConfirmDialogProps {
  open: boolean;
  totalItems: number;
  changes: Change[];
  onClose: () => void;
  onConfirm: () => Promise<void> | void; // support async
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
      setConfirming(false); // remove this line if you want button permanently disabled after confirm
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
                maxHeight: 250,
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>
                      Item Code
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>
                      Item Name
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>
                      Location
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>
                      New Stock
                    </TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {changes.map((change) => (
                    <TableRow
                      key={`${change.itemName}-${change.randomId}`}
                      hover
                    >
                      <TableCell align="center">{change.randomId}</TableCell>
                      <TableCell align="center">{change.varianceName}</TableCell>
                      <TableCell align="center">{change.locationId || "—"}</TableCell>
                      <TableCell align="center">{change.newValue}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Totals row */}
          <Box
            sx={{
              mt: 2,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
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

        <DialogActions sx={{ justifyContent: "center", pb: 2 }}>
          <Button
            onClick={onClose}
            color="primary"
            variant="outlined"
            sx={{ borderRadius: 2 }}
            disabled={confirming} // prevent cancel during processing
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            color="primary"
            variant="contained"
            sx={{ borderRadius: 2 }}
            disabled={confirming} // disable while processing
          >
            {confirming ? "Processing..." : "Confirm"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ConfirmDialog;
