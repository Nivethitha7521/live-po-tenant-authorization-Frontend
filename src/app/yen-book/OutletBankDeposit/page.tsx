"use client";
import React, { useState, ChangeEvent } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Button, TextField, Grid, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { RootState } from '../../../redux/store';
import { addDeposit, updateDeposit, deleteDeposit } from '../../../features/depositSlice';
// import { DateRangePickerField } from '../../../components/FormComponents'; // Adjust the path as necessary
import { exportCsv, importCsv } from '../../../utilities/csvUtils'; // Adjust the path as necessary
import YenBookPage from '../page';

interface Deposit {
  depositId: string;
  outletName: string;
  outletLocation: string;
  bankBranchName: string;
  bankName: string;
  depositDate: string;
  amount: string;
  currency: string;
  depositorName: string;
  depositorContact: string;
  salesDate: string;
  remarks: string;
  status: 'Pending' | 'Completed' | 'Failed';
  attachment?: File;
}

const initialDepositState: Deposit = {
  depositId: '',
  outletName: '',
  outletLocation: '',
  bankBranchName: '',
  bankName: '',
  depositDate: '',
  amount: '',
  currency: '',
  depositorName: '',
  depositorContact: '',
  salesDate: '',
  remarks: '',
  status: 'Pending',
};

const OutletBankDeposit: React.FC = () => {
  const dispatch = useDispatch();
  const deposits = useSelector((state: RootState) => state.deposit.deposits);
  const [depositData, setDepositData] = useState<Deposit>(initialDepositState);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [filterLocation, setFilterLocation] = useState('');
  const [filterBank, setFilterBank] = useState('');

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    setDepositData(initialDepositState);
    setEditIndex(null);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setDepositData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (e: SelectChangeEvent<string>) => {
    const { name, value } = e.target;
    setDepositData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAdd = () => {
    if (editIndex !== null) {
      dispatch(updateDeposit({ index: editIndex, deposit: depositData }));
    } else {
      dispatch(addDeposit(depositData));
    }
    handleClose();
  };

  const handleEdit = (index: number) => {
    const deposit = deposits[index];
    setDepositData(deposit);
    setEditIndex(index);
    setOpen(true);
  };

  const handleDelete = (index: number) => {
    dispatch(deleteDeposit(index));
  };

  const handleExport = () => {
    const headers = [
      { label: 'Deposit ID', key: 'depositId' },
      { label: 'Outlet Name', key: 'outletName' },
      { label: 'Outlet Location', key: 'outletLocation' },
      { label: 'Bank Branch Name', key: 'bankBranchName' },
      { label: 'Bank Name', key: 'bankName' },
      { label: 'Deposit Date', key: 'depositDate' },
      { label: 'Amount', key: 'amount' },
      { label: 'Currency', key: 'currency' },
      { label: 'Depositor Name', key: 'depositorName' },
      { label: 'Depositor Contact', key: 'depositorContact' },
      { label: 'Sales Date', key: 'salesDate' },
      { label: 'Remarks', key: 'remarks' },
      { label: 'Status', key: 'status' }
    ];
    exportCsv(deposits, headers, 'deposits.csv');
  };

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importCsv(file, (data: Deposit[]) => {
        data.forEach((deposit) => {
          dispatch(addDeposit(deposit));
        });
      });
    }
  };

  const handleFilterChange = (name: string, value: string) => {
    if (name === 'search') {
      setSearch(value);
    } else if (name === 'location') {
      setFilterLocation(value);
    } else if (name === 'bank') {
      setFilterBank(value);
    }
  };

  const handleDateRangeChange = (range: [Date | null, Date | null]) => {
    setDateRange(range);
  };

  const filteredDeposits = deposits.filter((deposit) =>
    deposit.outletName.toLowerCase().includes(search.toLowerCase()) ||
    deposit.bankName.toLowerCase().includes(search.toLowerCase()) ||
    deposit.outletLocation.toLowerCase().includes(filterLocation.toLowerCase()) ||
    deposit.bankName.toLowerCase().includes(filterBank.toLowerCase()) ||
    (dateRange[0] && dateRange[1]
      ? new Date(deposit.depositDate) >= dateRange[0] && new Date(deposit.depositDate) <= dateRange[1]
      : true)
  );

  return (
    <Box  sx={{marginLeft:'20px'}}>
    <YenBookPage/>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <TextField
          variant="outlined"
          label="Search Deposits"
          value={search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
          sx={{ flex: '1 1 300px' }}
        />
        <TextField
          variant="outlined"
          label="Filter by Location"
          value={filterLocation}
          onChange={(e) => handleFilterChange('location', e.target.value)}
          sx={{ flex: '1 1 300px', ml: 2 }}
        />
        <TextField
          variant="outlined"
          label="Filter by Bank"
          value={filterBank}
          onChange={(e) => handleFilterChange('bank', e.target.value)}
          sx={{ flex: '1 1 300px', ml: 2 }}
        />
        {/* <DateRangePickerField value={dateRange} onChange={handleDateRangeChange} /> */}
        <Box>
          <Button variant="contained" color="primary" onClick={handleOpen} startIcon={<AddIcon />} sx={{ ml: 2 }}>
            Create Deposit
          </Button>
          <Button variant="contained" color="secondary" onClick={handleExport} sx={{ ml: 2 }}>
            Export CSV
          </Button>
          <Button variant="contained" color="secondary" component="label" sx={{ ml: 2 }}>
            Import CSV
            <input type="file" accept=".csv" hidden onChange={handleImport} />
          </Button>
        </Box>
      </Box>

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>Create Deposit</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
          {Object.keys(depositData).map((key) => (
  <Grid item xs={12} sm={6} key={key}>
    {key === 'status' ? (
      <FormControl fullWidth margin="dense">
        <InputLabel>Status</InputLabel>
        <Select
          label="Status"
          name={key}
          value={depositData[key as keyof Deposit] as string} // Ensure value is treated as a string
          onChange={handleSelectChange}
        >
          {['Pending', 'Completed', 'Failed'].map((option) => (
            <MenuItem key={option} value={option}>{option}</MenuItem>
          ))}
        </Select>
      </FormControl>
    ) : key !== 'attachment' ? ( // Exclude 'attachment' from the regular text fields
      <TextField
        margin="dense"
        label={key.replace(/([A-Z])/g, ' $1').trim()}
        name={key}
        value={depositData[key as keyof Deposit] as string} // Ensure this is a string for non-attachment fields
        onChange={handleChange}
        fullWidth
      />
    ) : (
      <TextField
        type="file"
        label="Attachment"
        name="attachment"
        onChange={(e: ChangeEvent<HTMLInputElement>) => setDepositData(prev => ({
          ...prev,
          attachment: e.target.files?.[0] // Handle the file input separately
        }))}
        fullWidth
      />
    )}
  </Grid>
))}

            <Grid item xs={12}>
              <TextField
                type="file"
                label="Attachment"
                name="attachment"
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDepositData(prev => ({
                  ...prev,
                  attachment: e.target.files?.[0]
                }))}
                fullWidth
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleAdd} color="primary">
            {editIndex !== null ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {Object.keys(initialDepositState).map((key) => (
                key !== 'attachment' && (
                  <TableCell key={key}>{key.replace(/([A-Z])/g, ' $1').trim()}</TableCell>
                )
              ))}
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {/* {filteredDeposits.map((deposit, index) => (
              <TableRow key={index}>
                {Object.keys(initialDepositState).map((key) => (
                  key !== 'attachment' && (
<TableCell>
  {typeof deposit === 'string' ? deposit : deposit instanceof File ? deposit.name : 'No data'}
</TableCell>
                  )
                ))}
                <TableCell>
                  <IconButton onClick={() => handleEdit(index)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(index)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))} */}
          </TableBody>
        </Table>
      </TableContainer>
    </Box> 
  );
};

export default OutletBankDeposit;
