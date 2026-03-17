"use client";
import React from "react";
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
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import TableChartIcon from "@mui/icons-material/TableChart";


interface Stock {
  itemName: string;
  varianceName?: string;
  locationId: string;
  newValue: number;
}

interface UpdatedStocksModalProps {
  open: boolean;
  updatedStocks: Stock[];
  onClose: () => void;
  onDownloadPDF: () => void;
  onDownloadExcel: () => void;
  
}

const UpdatedStocksModal: React.FC<UpdatedStocksModalProps> = ({
  open,
  updatedStocks,
  onClose,
  onDownloadPDF,
  onDownloadExcel,
}) => {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Updated Stocks</DialogTitle>
      <DialogContent>
        <TableContainer component={Paper} style={{ maxHeight: 400 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Item Name</TableCell>
                <TableCell>Variance</TableCell>
                <TableCell>Branch Name</TableCell>
                <TableCell>New Stock Value</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {updatedStocks.map((stock) => (
                <TableRow
                  key={`${stock.itemName}-${stock.varianceName}-${stock.locationId}`}
                >
                  <TableCell>{stock.itemName}</TableCell>
                  <TableCell>{stock.varianceName}</TableCell>
                  <TableCell>{stock.locationId}</TableCell>
                  <TableCell>{stock.newValue}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onDownloadPDF}
          color="primary"
          startIcon={<PictureAsPdfIcon />}
        >
          Download PDF
        </Button>
        <Button
          onClick={onDownloadExcel}
          color="primary"
          startIcon={<TableChartIcon  />}
        >
          Download Excel
        </Button>
        <Button onClick={onClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UpdatedStocksModal;