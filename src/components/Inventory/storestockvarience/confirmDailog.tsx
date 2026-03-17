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

// interface ConfirmDialogProps {
//   open: boolean;
//   totalItems: number;
//   changesLength: number;
//   onClose: (confirm: boolean) => void;
//   fullScreen: boolean;
// }

// const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
//   open,
//   totalItems,
//   changesLength,
//   onClose,
//   fullScreen,
// }) => {
//   return (
//     <Dialog
//       open={open}
//       onClose={() => onClose(false)}
//       fullScreen={fullScreen}
//       sx={fullScreen ? { zIndex: 10000 } : {}}
//     >
//       <DialogTitle>Confirm Save</DialogTitle>
//       <DialogContent>
//         <DialogContentText sx={{ mb: 2, textAlign: "left" }}>
//           Total Items: {totalItems}
//           <br />
//           Edited Items: {changesLength}
//         </DialogContentText>
//       </DialogContent>
//       <DialogActions>
//         <Button onClick={() => onClose(false)} color="secondary">
//           Cancel
//         </Button>
//         <Button onClick={() => onClose(true)} color="primary">
//           Confirm
//         </Button>
//       </DialogActions>
//     </Dialog>
//   );
// };

// export default ConfirmDialog;