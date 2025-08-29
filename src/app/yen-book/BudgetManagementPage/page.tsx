"use client";
import React, { useState, ChangeEvent } from 'react';
import { useDispatch } from 'react-redux';
import {
  Box, TextField, Button, Typography, Grid, Paper,
  TableContainer, Table, TableHead, TableRow, TableCell, TableBody
} from '@mui/material';
import UploadButton from '../../../components/UploadButton';
import { addBudget } from '../../../features/budgetSlice';
import { RootState } from '../../../redux/store'; // Adjust the path as necessary
import YenBookPage from '../page';

interface BudgetAdjustment {
  adjustmentId: string;
  adjustmentDate: string;
  adjustmentAmount: string;
  reasonForAdjustment: string;
  approvedBy: string;
}

interface BudgetData {
  budgetId: string;
  department: string;
  budgetName: string;
  budgetPeriodStart: string;
  budgetPeriodEnd: string;
  totalBudgetAmount: string;
  allocatedAmount: string;
  spentAmount: string;
  remainingBudget: string;
  budgetCategory: string;
  description: string;
  responsiblePerson: string;
  approvalStatus: string;
  approvalDate: string;
  approverName: string;
  notes: string;
  attachments: string | null;
  createdDate: string;
  lastUpdatedDate: string;
  budgetAdjustments: BudgetAdjustment[];
}

const initialBudgetState: BudgetData = {
  budgetId: '',
  department: '',
  budgetName: '',
  budgetPeriodStart: '',
  budgetPeriodEnd: '',
  totalBudgetAmount: '',
  allocatedAmount: '',
  spentAmount: '',
  remainingBudget: '',
  budgetCategory: '',
  description: '',
  responsiblePerson: '',
  approvalStatus: '',
  approvalDate: '',
  approverName: '',
  notes: '',
  attachments: null,
  createdDate: '',
  lastUpdatedDate: '',
  budgetAdjustments: [],
};

const initialAdjustmentState: BudgetAdjustment = {
  adjustmentId: '',
  adjustmentDate: '',
  adjustmentAmount: '',
  reasonForAdjustment: '',
  approvedBy: '',
};

const BudgetManagementPage: React.FC = () => {
  const dispatch = useDispatch();
  const [budgetData, setBudgetData] = useState<BudgetData>(initialBudgetState);
  const [newAdjustment, setNewAdjustment] = useState<BudgetAdjustment>(initialAdjustmentState);
  const [uploadFile, setUploadFile] = useState<string | null>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setBudgetData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAdjustmentChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewAdjustment((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddAdjustment = () => {
    setBudgetData((prev) => ({
      ...prev,
      budgetAdjustments: [...prev.budgetAdjustments, newAdjustment],
    }));
    setNewAdjustment(initialAdjustmentState);
  };

  const handleUpload = (files: FileList | null) => {
    if (files && files.length > 0) {
      const file = files[0]; // Assuming you want to handle only the first file
      const reader = new FileReader();
  
      reader.onload = (event) => {
        const result = event.target?.result;
        if (result) {
          setUploadFile(result as string); // Set the uploaded file content as a string
        }
      };
  
      reader.readAsText(file); // Read the file content as text (or you can use reader.readAsDataURL, reader.readAsArrayBuffer depending on your requirement)
    }
  };
  

  const handleSubmit = () => {
    const dataToSubmit = { ...budgetData, attachments: uploadFile };
    dispatch(addBudget(dataToSubmit));
    // Reset form after submission
    setBudgetData(initialBudgetState);
    setUploadFile(null);
  };

  return (
    <Box sx={{ p: 3 }}>
    <YenBookPage />
      <Typography variant="h4" gutterBottom>
        Budget Management
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            fullWidth
            label="Budget ID"
            name="budgetId"
            value={budgetData.budgetId}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            fullWidth
            label="Department"
            name="department"
            value={budgetData.department}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            fullWidth
            label="Budget Name"
            name="budgetName"
            value={budgetData.budgetName}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            fullWidth
            label="Budget Period Start"
            name="budgetPeriodStart"
            type="date"
            value={budgetData.budgetPeriodStart}
            onChange={handleChange}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            fullWidth
            label="Budget Period End"
            name="budgetPeriodEnd"
            type="date"
            value={budgetData.budgetPeriodEnd}
            onChange={handleChange}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            fullWidth
            label="Total Budget Amount"
            name="totalBudgetAmount"
            value={budgetData.totalBudgetAmount}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            fullWidth
            label="Allocated Amount"
            name="allocatedAmount"
            value={budgetData.allocatedAmount}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            fullWidth
            label="Spent Amount"
            name="spentAmount"
            value={budgetData.spentAmount}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            fullWidth
            label="Remaining Budget"
            name="remainingBudget"
            value={budgetData.remainingBudget}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            fullWidth
            label="Budget Category"
            name="budgetCategory"
            value={budgetData.budgetCategory}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            fullWidth
            label="Description"
            name="description"
            value={budgetData.description}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            fullWidth
            label="Responsible Person"
            name="responsiblePerson"
            value={budgetData.responsiblePerson}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            fullWidth
            label="Approval Status"
            name="approvalStatus"
            value={budgetData.approvalStatus}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            fullWidth
            label="Approval Date"
            name="approvalDate"
            type="date"
            value={budgetData.approvalDate}
            onChange={handleChange}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            fullWidth
            label="Approver Name"
            name="approverName"
            value={budgetData.approverName}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Notes/Comments"
            name="notes"
            value={budgetData.notes}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={12}>
          <UploadButton onUpload={handleUpload} />
        </Grid>
        <Grid item xs={12}>
          <Typography variant="h6">Budget Adjustments</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Adjustment ID"
                name="adjustmentId"
                value={newAdjustment.adjustmentId}
                onChange={handleAdjustmentChange}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Adjustment Date"
                name="adjustmentDate"
                type="date"
                value={newAdjustment.adjustmentDate}
                onChange={handleAdjustmentChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Adjustment Amount"
                name="adjustmentAmount"
                value={newAdjustment.adjustmentAmount}
                onChange={handleAdjustmentChange}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Reason for Adjustment"
                name="reasonForAdjustment"
                value={newAdjustment.reasonForAdjustment}
                onChange={handleAdjustmentChange}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Approved By"
                name="approvedBy"
                value={newAdjustment.approvedBy}
                onChange={handleAdjustmentChange}
              />
            </Grid>
            <Grid item xs={12}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleAddAdjustment}
              >
                Add Adjustment
              </Button>
            </Grid>
          </Grid>

          <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Adjustment ID</TableCell>
                  <TableCell>Adjustment Date</TableCell>
                  <TableCell>Adjustment Amount</TableCell>
                  <TableCell>Reason for Adjustment</TableCell>
                  <TableCell>Approved By</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {budgetData.budgetAdjustments.map((adjustment, index) => (
                  <TableRow key={index}>
                    <TableCell>{adjustment.adjustmentId}</TableCell>
                    <TableCell>{adjustment.adjustmentDate}</TableCell>
                    <TableCell>{adjustment.adjustmentAmount}</TableCell>
                    <TableCell>{adjustment.reasonForAdjustment}</TableCell>
                    <TableCell>{adjustment.approvedBy}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
        <Grid item xs={12}>
          <Button variant="contained" color="primary" onClick={handleSubmit}>
            Submit
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
};

export default BudgetManagementPage;
