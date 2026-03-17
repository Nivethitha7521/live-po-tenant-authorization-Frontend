// "use client";
// import React from "react";
// import {
//   Dialog,
//   DialogTitle,
//   DialogContent,
//   DialogContentText,
//   DialogActions,
//   Button,
// } from "@mui/material";

// interface FinalConfirmDialogProps {
//   open: boolean;
//   totalItems: number;
//   changesLength: number;
//   onClose: () => void;
//   onConfirm: () => void;
// }

// const FinalConfirmDialog: React.FC<FinalConfirmDialogProps> = ({
//   open,
//   totalItems,
//   changesLength,
//   onClose,
//   onConfirm,
// }) => {
//   return (
//     <Dialog open={open} onClose={onClose}>
//       <DialogTitle>Final Confirmation</DialogTitle>
//       <DialogContent>
//         <DialogContentText>
//           You are about to update {changesLength} items out of {totalItems}.
//           <br />
//           <br />
//           Are you definitely sure you want to update? Do you want to proceed?
//         </DialogContentText>
//       </DialogContent>
//       <DialogActions>
//         <Button onClick={onClose} color="primary">
//           Cancel
//         </Button>
//         <Button onClick={onConfirm} color="primary">
//           Confirm
//         </Button>
//       </DialogActions>
//     </Dialog>
//   );
// };

// export default FinalConfirmDialog;