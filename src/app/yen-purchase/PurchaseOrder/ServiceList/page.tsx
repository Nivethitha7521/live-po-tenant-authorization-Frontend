"use client";
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/redux/store';
import { format } from 'date-fns';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description'; // CSV icon
import { Add as AddIcon } from '@mui/icons-material';
import FilterAltIcon from '@mui/icons-material/FilterAlt'; // Import the filter icon
import ClearIcon from "@mui/icons-material/Clear"; // Clear icon
import {
  Box, Button, Typography, Table, TableContainer, TableHead, TableRow, TableCell, TableBody,
  Paper, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Tooltip,
  Grid,
  Snackbar,
  Alert,
  DialogContentText,
  Menu,
  MenuItem,
  Chip,
  Autocomplete
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ServiceData, ServiceDescription } from '../Models/servicepo';
import { VendorSearch } from '@/Models/vendor';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import YenPurchasePage from '../page';
import jsPDF from "jspdf";
import "jspdf-autotable"; // Ensure this is imported
import { fetchServices, selectServiceState, setSnackbarMessage, setSnackbarOpen } from '../Features/servicepo';
import { fetchBusinesses, selectBusinesses } from '@/features/account-setting/businessSlice';
import Papa from 'papaparse';
import 'react-date-range/dist/styles.css'; // main style file
import 'react-date-range/dist/theme/default.css'; // theme css file
import DateRangeDialog from '@/components/dateRange';
import moment from 'moment';
import VendorSearchAutocomplete from '@/components/vendorsearchautocomplete';
import PurchaseOrderRandomIdSearch from '@/components/yen-purchase/pendingpo/infiniteScroll';

// Add the TypeScript declaration for autoTable (if necessary)
declare module 'jspdf' {
  interface jsPDF {
    autoTable: any;
  }
}
interface AutoTableHookData {
  cursor?: { x: number; y: number };
  settings?: any;
  pageNumber?: number;
  doc: jsPDF;
}

const ServiceList: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const serviceOrder = useSelector(selectServiceState);
  const { services, loading, error, vendors, snackbarMessage, snackbarOpen } = serviceOrder;
  const { businesses } = useSelector(selectBusinesses);
  const [selectedOrder, setSelectedOrder] = useState<ServiceData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectionRange, setSelectionRange] = useState({
    startDate: new Date(),
    endDate: new Date(),
    key: 'selection',
  });
  const [selectedVendor, setSelectedVendor] = useState<VendorSearch | null>(null);
  const [selectedVendorName, setSelectedVendorName] = useState('');
  const [selectedRandomId, setSelectedRandomId] = useState('');
  const [filteredServices, setFilteredServices] = useState<ServiceData[]>([]);
  const [dialogDownloadOpen, setDialogDownloadOpen] = useState(false);
  const [dialogSummaryOpen, setDialogSummaryOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchBusinesses());
    dispatch(fetchServices());
  }, [dispatch]);

  useEffect(() => {
    setFilteredServices(services);
  }, [services]);

  const handleVendorChange = (vendor: VendorSearch | null) => {
    setSelectedVendor(vendor);
    setSelectedVendorName(vendor ? vendor.vendorName : '');
  };

  const handleRandomIdChange = (randomId: string) => {
    setSelectedRandomId(randomId);
  };

  const handleFilterClick = () => {
    let filtered = services;

    // Filter by vendor
    if (selectedVendorName) {
      filtered = filtered.filter((service: ServiceData) => service.vendorName.toLowerCase().includes(selectedVendorName.toLowerCase()));
    }

    // Filter by randomId
    if (selectedRandomId) {
      filtered = filtered.filter((service: ServiceData) => service.randomId === selectedRandomId);
    }

    // Filter by date range
    if (selectionRange.startDate && selectionRange.endDate) {
      const start = moment(selectionRange.startDate).startOf('day').toDate();
      const end = moment(selectionRange.endDate).endOf('day').toDate();
      filtered = filtered.filter((service: ServiceData) => {
        const orderDate = new Date(service.orderDate || '');
        return orderDate >= start && orderDate <= end;
      });
    }

    setFilteredServices(filtered);
  };

  const handleFilterClose = () => {
    setSelectionRange({
      startDate: new Date(),
      endDate: new Date(),
      key: 'selection',
    });
    setSelectedVendor(null);
    setSelectedVendorName('');
    setSelectedRandomId('');
    setFilteredServices(services);
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseAnchor = () => {
    setAnchorEl(null);
  };

  const handleVendorwiseClick = () => {
    setDialogDownloadOpen(true);
    handleCloseAnchor();
  };

  const handleDescriptionwiseClick = () => {
    setDialogSummaryOpen(true);
    handleCloseAnchor();
  };

  const handleViewDetailsClick = (serviceId: string) => {
    const selected = services.find((s: ServiceData) => s.serviceId === serviceId);
    if (selected) {
      setSelectedOrder(selected);
      setDialogOpen(true);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedOrder(null);
  };

  const handleClose = () => {
    setDialogSummaryOpen(false);
  };

  const handleCloseDownload = () => {
    setDialogDownloadOpen(false);
  };

  const handleCloseSnackbar = () => {
    dispatch(setSnackbarOpen(false));
  };

  // Compute tax details for display
  const [taxDetails, setTaxDetails] = useState<Record<string, { amount: number; percentage: number; type: string }>>({});

  useEffect(() => {
    if (selectedOrder) {
      const details: Record<string, { amount: number; percentage: number; type: string }> = {};
      selectedOrder.descriptions.forEach((desc: ServiceDescription) => {
        const taxType = desc.tax_type;
        const taxPer = desc.tax_per;
        let sgst = 0, cgst = 0, igst = 0;
        if (taxType === 'igst') {
          igst = desc.igst;
          const key = `igst-${taxPer}`;
          details[key] = details[key] || { amount: 0, percentage: taxPer, type: 'IGST' };
          details[key].amount += igst;
        } else {
          sgst = desc.sgst;
          cgst = desc.cgst;
          const halfPer = taxPer / 2;
          const sgstKey = `sgst-${halfPer}`;
          details[sgstKey] = details[sgstKey] || { amount: 0, percentage: halfPer, type: 'SGST' };
          details[sgstKey].amount += sgst;
          const cgstKey = `cgst-${halfPer}`;
          details[cgstKey] = details[cgstKey] || { amount: 0, percentage: halfPer, type: 'CGST' };
          details[cgstKey].amount += cgst;
        }
      });
      setTaxDetails(details);
    }
  }, [selectedOrder]);

  const generatePDF = () => {
    const doc = new jsPDF();
    let yOffset = 7;
    let pageCount = 1;
    const business = businesses[0] || null;
    if (!business) return;

    const addPageFooter = (currentPage: number, totalPages: number) => {
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      const pageText = `Page ${currentPage} of ${totalPages}`;
      const pageTextWidth = doc.getStringUnitWidth(pageText) * doc.getFontSize() / doc.internal.scaleFactor;
      const pageX = (pageWidth - pageTextWidth) / 2;
      doc.text(pageText, pageX, pageHeight - 10);
      const generatedText = 'This is computer generated';
      const generatedTextWidth = doc.getStringUnitWidth(generatedText) * doc.getFontSize() / doc.internal.scaleFactor;
      const generatedX = (pageWidth - generatedTextWidth) / 2;
      doc.text(generatedText, generatedX, pageHeight - 5);
    };

    if (business.imageUrl) {
      doc.addImage(business.imageUrl, 'JPEG', 14, yOffset, 20, 20);
    }
    yOffset += 7;

    doc.setFontSize(12);
    const title = "Service Order Summary";
    const pageWidth = doc.internal.pageSize.width;
    const fontSize = doc.getFontSize();
    const titleWidth = doc.getStringUnitWidth(title) * fontSize / doc.internal.scaleFactor;
    const titleX = (pageWidth - titleWidth) / 2;
    doc.text(title, titleX, yOffset);
    doc.line(titleX, yOffset + 2, titleX + titleWidth, yOffset + 2);
    yOffset += 13;

    const totalOrderedAmount = filteredServices.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const today = new Date();
    const currentDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

    doc.setFontSize(10);
    const totalText = `Total Ordered Amount: ${totalOrderedAmount.toFixed(2)}`;
    const dateText = `Date: ${currentDate}`;
    const totalWidth = doc.getStringUnitWidth(totalText) * 10 / doc.internal.scaleFactor;
    const dateWidth = doc.getStringUnitWidth(dateText) * 10 / doc.internal.scaleFactor;
    doc.text(totalText, 14, yOffset);
    doc.text(dateText, pageWidth - dateWidth - 14, yOffset);
    yOffset += 5;

    const headers = [["S.No", "Service ID", "Vendor Name", "Total Descriptions", "Order Date", "Total Amount"]];
    const rows = filteredServices.map((service: ServiceData, index: number) => {
      const totalDescs = service.descriptions.length;
      const orderDate = service.orderDate ? format(new Date(service.orderDate), 'dd-MM-yyyy') : '';
      return [
        (index + 1).toString(),
        service.randomId,
        service.vendorName,
        totalDescs.toString(),
        orderDate,
        service.totalAmount.toFixed(2),
      ];
    });

    doc.autoTable({
      head: headers,
      body: rows,
      startY: yOffset,
      styles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [0, 0, 128], textColor: [255, 255, 255], fontSize: 8, halign: 'center' },
      bodyStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0] },
      columnStyles: {
        0: { cellWidth: 17, halign: 'center' },
        1: { cellWidth: 28, halign: 'center' },
        2: { cellWidth: 46, halign: 'center' },
        3: { cellWidth: 28, halign: 'center' },
        4: { cellWidth: 28, halign: 'center' },
        5: { cellWidth: 35, halign: 'right' },
      },
      margin: { left: 14, right: 14 },
      tableWidth: 182,
      didDrawPage: (data: AutoTableHookData) => {
        addPageFooter(pageCount++, doc.getNumberOfPages());
      },
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addPageFooter(i, totalPages);
    }

    doc.save('ServiceVendorwise.pdf');
    setDialogDownloadOpen(false);
  };

  const handleExportCSV = () => {
    const headers = 'SNO,Service ID,Vendor Name,Total Descriptions,Order Date,Total Amount\n';
    const rows = filteredServices.map((service: ServiceData, index: number) => {
      const totalDescs = service.descriptions.length;
      const orderDate = service.orderDate ? format(new Date(service.orderDate), 'dd-MM-yyyy') : '';
      return [
        (index + 1),
        service.randomId,
        service.vendorName,
        totalDescs,
        orderDate,
        service.totalAmount.toFixed(2),
      ].join(',');
    }).join('\n');
    const csvContent = `${headers}${rows}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', 'ServiceVendorwise.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDialogDownloadOpen(false);
  };

  const generateSummaryPDF = () => {
    const doc = new jsPDF();
    let yOffset = 10;
    let pageCount = 1;
    const business = businesses[0] || null;
    if (!business) return;

    const addPageFooter = (currentPage: number, totalPages: number) => {
      // Same as above
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      const pageText = `Page ${currentPage} of ${totalPages}`;
      const pageTextWidth = doc.getStringUnitWidth(pageText) * doc.getFontSize() / doc.internal.scaleFactor;
      const pageX = (pageWidth - pageTextWidth) / 2;
      doc.text(pageText, pageX, pageHeight - 10);
      const generatedText = 'This is computer generated';
      const generatedTextWidth = doc.getStringUnitWidth(generatedText) * doc.getFontSize() / doc.internal.scaleFactor;
      const generatedX = (pageWidth - generatedTextWidth) / 2;
      doc.text(generatedText, generatedX, pageHeight - 5);
    };

    if (business.imageUrl) {
      doc.addImage(business.imageUrl, 'JPEG', 14, yOffset, 20, 20);
    }
    yOffset += 10;

    doc.setFontSize(12);
    const title = "Service Order Detailed Summary";
    const pageWidth = doc.internal.pageSize.width;
    const fontSize = doc.getFontSize();
    const titleWidth = doc.getStringUnitWidth(title) * fontSize / doc.internal.scaleFactor;
    const titleX = (pageWidth - titleWidth) / 2;
    doc.text(title, titleX, yOffset);
    doc.setLineWidth(0.1);
    doc.line(titleX, yOffset + 2, titleX + titleWidth, yOffset + 2);
    yOffset += 15;

    const totalOrderedAmount = filteredServices.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const today = new Date();
    const currentDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
    doc.setFontSize(10);
    const totalText = `Total Ordered Amount: ${totalOrderedAmount.toFixed(2)}`;
    const dateText = `Date: ${currentDate}`;
    const dateWidth = doc.getStringUnitWidth(dateText) * 10 / doc.internal.scaleFactor;
    doc.text(totalText, 14, yOffset);
    doc.text(dateText, pageWidth - dateWidth - 14, yOffset);
    yOffset += 5;

    const headers = [["S.No", "Service No", "Vendor Name", "Description", "From Date", "To Date", "Fee", "Tax %", "Total"]];
    const rows = filteredServices.map((service: ServiceData, sIndex: number) => 
      service.descriptions.map((desc: ServiceDescription, dIndex: number) => {
        const globalIndex = sIndex * service.descriptions.length + dIndex + 1;
        const fromDate = desc.from_date ? format(new Date(desc.from_date), 'dd-MM-yyyy') : '';
        const toDate = desc.to_date ? format(new Date(desc.to_date), 'dd-MM-yyyy') : '';
        return [
          globalIndex.toString(),
          service.randomId,
          service.vendorName,
          desc.description,
          fromDate,
          toDate,
          desc.fee.toFixed(2),
          `${desc.tax_per}%`,
          desc.total.toFixed(2),
        ];
      })
    ).flat();

    doc.autoTable({
      head: headers,
      body: rows,
      startY: yOffset,
      styles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [0, 0, 128], textColor: [255, 255, 255], fontSize: 8, halign: 'center' },
      bodyStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0] },
      columnStyles: {
        6: { halign: 'right' },
        7: { halign: 'center' },
        8: { halign: 'right' },
      },
      didDrawPage: (data: AutoTableHookData) => {
        addPageFooter(pageCount++, doc.getNumberOfPages());
      },
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addPageFooter(i, totalPages);
    }

    doc.save('ServiceDescriptionwise.pdf');
    handleClose();
  };

  const generateSummaryCSV = () => {
    const headers = ["S.No", "Service No", "Vendor Name", "Description", "From Date", "To Date", "Fee", "Tax %", "Total"];
    const rows = filteredServices.map((service: ServiceData, sIndex: number) => 
      service.descriptions.map((desc: ServiceDescription, dIndex: number) => {
        const globalIndex = sIndex * service.descriptions.length + dIndex + 1;
        const fromDate = desc.from_date ? format(new Date(desc.from_date), 'dd-MM-yyyy') : '';
        const toDate = desc.to_date ? format(new Date(desc.to_date), 'dd-MM-yyyy') : '';
        return [
          globalIndex,
          service.randomId,
          service.vendorName,
          desc.description,
          fromDate,
          toDate,
          desc.fee.toFixed(2),
          `${desc.tax_per}%`,
          desc.total.toFixed(2),
        ];
      })
    ).flat();
    const csvData = [headers, ...rows];
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "ServiceDescriptionwise.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    handleClose();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Typography>Error: {error}</Typography>;
  }

  return (
    <Box>
      <YenPurchasePage />
      <Box sx={{ px: 2, py: 1 }}>
        <Grid container spacing={2} sx={{ mb: 1 }}>
          <Grid item xs={12}>
            <Typography variant="h6">Service Orders List</Typography>
          </Grid>
        </Grid>
        <Grid
          container
          spacing={1}
          alignItems="center"
          justifyContent="flex-start"
          wrap="nowrap"
          sx={{
            display: 'inline-flex',
            minWidth: '100%',
          }}
        >
          <Grid item xs="auto">
            <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <DateRangeDialog
                selectionRange={selectionRange}
                setSelectionRange={setSelectionRange}
                onApply={handleFilterClick}
              />
            </Box>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <VendorSearchAutocomplete
              value={selectedVendor}
              onChange={handleVendorChange}
              label="All Vendors"
            />
          </Grid>
          <Grid item xs={6} sm={4} md={1}>
            <PurchaseOrderRandomIdSearch
              value={selectedRandomId}
              onChange={handleRandomIdChange}
              label="Service ID"
            />
          </Grid>
          <Grid item xs="auto">
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <IconButton
                onClick={handleFilterClick}
                className="icon-button-outline"
                color="primary"
                size="small"
                sx={{ p: 0.3 }}
              >
                <FilterAltIcon fontSize="small" />
              </IconButton>
              <Typography variant="caption" align="center" sx={{ maxWidth: 60, wordBreak: 'break-word', mt: 0.2 }}>
                Filter
              </Typography>
            </Box>
          </Grid>
          <Grid item xs="auto">
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <IconButton
                onClick={handleFilterClose}
                className="icon-button-outline"
                color="primary"
                size="small"
                sx={{ p: 0.3 }}
              >
                <ClearIcon fontSize="small" />
              </IconButton>
              <Typography variant="caption" align="center" sx={{ maxWidth: 60, wordBreak: 'break-word', mt: 0.2 }}>
                Clear
              </Typography>
            </Box>
          </Grid>
          <Grid item xs sx={{ flexGrow: 1 }} />
          <Grid item xs="auto">
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <IconButton
                onClick={handleClick}
                color="primary"
                className="icon-button-outline"
                size="small"
                sx={{ p: 0.3 }}
                disabled={!filteredServices.length}
              >
                <DownloadIcon fontSize="small" />
              </IconButton>
              <Typography variant="caption" align="center" sx={{ maxWidth: 60, wordBreak: 'break-word', mt: 0.2 }}>
                Download
              </Typography>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleCloseAnchor}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                <MenuItem onClick={handleVendorwiseClick}>Vendorwise</MenuItem>
                <MenuItem onClick={handleDescriptionwiseClick}>Descriptionwise</MenuItem>
              </Menu>
            </Box>
          </Grid>
        </Grid>
        <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth={false} fullWidth={true}>
          <DialogTitle sx={{ fontWeight: 'bold' }}>
            Service Order Details {selectedOrder?.randomId ? `${selectedOrder.randomId}` : ''}
          </DialogTitle>
          <DialogContent>
            <TableContainer component={Paper}>
              <Table stickyHeader sx={{ minWidth: 500, fontSize: '0.875rem' }}>
                <TableHead>
                  <TableRow>
                    <TableCell>S.No</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>From Date</TableCell>
                    <TableCell>To Date</TableCell>
                    <TableCell>Fee</TableCell>
                    <TableCell>Tax (%)</TableCell>
                    <TableCell>Tax Amount</TableCell>
                    <TableCell>Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedOrder?.descriptions.map((desc: ServiceDescription, index: number) => (
                    <TableRow key={desc.id || index}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{desc.description}</TableCell>
                      <TableCell>{desc.from_date ? format(new Date(desc.from_date), 'dd-MM-yyyy') : ''}</TableCell>
                      <TableCell>{desc.to_date ? format(new Date(desc.to_date), 'dd-MM-yyyy') : ''}</TableCell>
                      <TableCell align="right">{desc.fee.toFixed(2)}</TableCell>
                      <TableCell align="center">{desc.tax_per}%</TableCell>
                      <TableCell align="right">{(desc.sgst + desc.cgst + desc.igst).toFixed(2)}</TableCell>
                      <TableCell align="right">{desc.total.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={4} align="right">
                      <strong>Freight Charges:</strong>
                    </TableCell>
                    <TableCell align="right">{(selectedOrder?.totalFreightAmount || 0).toFixed(2)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell align="right">{(selectedOrder?.totalFreightTaxAmount || 0).toFixed(2)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={4} align="right">
                      <strong>Overall Discount:</strong>
                    </TableCell>
                    <TableCell align="right" colSpan={4}>-{(selectedOrder?.overallDiscountValue || 0).toFixed(2)}</TableCell>
                  </TableRow>
                  {Object.entries(taxDetails).map(([key, tax]) => (
                    <TableRow key={key}>
                      <TableCell colSpan={6}></TableCell>
                      <TableCell>
                        <strong>{tax.type} ({tax.percentage}%):</strong>
                      </TableCell>
                      <TableCell align="right">{tax.amount.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={7}></TableCell>
                    <TableCell align="right"><strong>Total Amount:</strong></TableCell>
                    <TableCell align="right">{(selectedOrder?.totalAmount || 0).toFixed(2)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDialogClose} color="primary">Close</Button>
          </DialogActions>
        </Dialog>
        <Dialog open={dialogDownloadOpen} onClose={handleCloseDownload}>
          <DialogTitle>Select Export Format</DialogTitle>
          <DialogContent>
            Choose whether you want to download the report as a CSV file or generate a PDF.
          </DialogContent>
          <DialogActions>
            <Button onClick={handleExportCSV} variant="contained" color="primary" startIcon={<DescriptionIcon />}>
              Download CSV
            </Button>
            <Button onClick={generatePDF} variant="contained" color="secondary" startIcon={<PictureAsPdfIcon />}>
              Generate PDF
            </Button>
            <Button onClick={handleCloseDownload} variant="outlined">Cancel</Button>
          </DialogActions>
        </Dialog>
        <Dialog open={dialogSummaryOpen} onClose={handleClose}>
          <DialogTitle>Export Options</DialogTitle>
          <DialogContent>
            <DialogContentText>Please choose whether you want to export the data as a CSV or generate a PDF.</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={generateSummaryCSV} variant="contained" color="secondary" startIcon={<DescriptionIcon />}>
              Export CSV
            </Button>
            <Button onClick={generateSummaryPDF} variant="contained" color="primary" startIcon={<PictureAsPdfIcon />}>
              Generate PDF
            </Button>
            <Button variant="outlined" onClick={handleClose}>Cancel</Button>
          </DialogActions>
        </Dialog>
        <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 245px)', overflowY: 'auto', width: '100%', mt: 0.7 }}>
          <Table stickyHeader sx={{ tableLayout: 'fixed', width: '100%' }}>
            <TableHead>
              <TableRow>
                <TableCell>S.No</TableCell>
                <TableCell>Service ID</TableCell>
                <TableCell>Vendor Name</TableCell>
                <TableCell>Total Descriptions</TableCell>
                <TableCell>Total Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredServices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">No services found.</TableCell>
                </TableRow>
              ) : (
                filteredServices.map((service: ServiceData, index: number) => (
                  <TableRow key={service.serviceId}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{service.randomId}</TableCell>
                    <TableCell>{service.vendorName}</TableCell>
                    <TableCell>{service.descriptions.length}</TableCell>
                    <TableCell align="right">{service.totalAmount.toFixed(2)}</TableCell>
                    <TableCell>{service.status}</TableCell>
                    <TableCell>
                      <Tooltip title="View Details">
                        <IconButton onClick={() => handleViewDetailsClick(service.serviceId)} color="primary">
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <Snackbar
          open={snackbarOpen}
          message={snackbarMessage}
          autoHideDuration={3000}
          onClose={handleCloseSnackbar}
        />
      </Box>
    </Box>
  );
};

export default React.memo(ServiceList);