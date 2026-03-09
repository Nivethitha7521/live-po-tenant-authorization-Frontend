// app/yen-settings/DateSettings/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  RadioGroup,
  Radio,
  FormControlLabel,
  FormLabel,
  Chip,
  Stack,
  IconButton,
  FormControl,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DateRangeIcon from '@mui/icons-material/DateRange';
import TodayIcon from '@mui/icons-material/Today';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/redux/store';
import {
  fetchDateSettings,
  saveDateSettings,
  updateOrderDateRestriction,
  updateExpectedDeliveryDays,
  updateInvoiceRestriction,
  clearError,
  RestrictionType,
  InvoiceRestrictionType,
  UpdateRestrictionPayload,
  UpdateInvoicePayload
} from '../Features/PurchaseDateSettingSlice';
import { format, addDays, subDays } from 'date-fns';
import { useRouter } from 'next/navigation';

const DateSettingsPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  
  // Fix: Add proper type safety with RootState
const { settings, loading, error, lastUpdated } = useSelector(
  (state: RootState) => state.purchaseDateSettings
);

const role = useSelector((state: RootState) => state.auth.role);

// ✅ BLOCK NON-ADMIN HERE (ADD THIS EXACT PLACE)
if (role !== "Admin") {
  return (
    <Box sx={{ p: 4, textAlign: "center", mt: 8 }}>
      <Typography variant="h5" color="error" gutterBottom>
        Access Denied
      </Typography>

      <Typography color="textSecondary">
        You don't have permission to access this page.
      </Typography>

      <Button sx={{ mt: 2 }} variant="contained" onClick={() => router.push("/")}>
        Go Dashboard
      </Button>
    </Box>
  );
}  
  const [successMessage, setSuccessMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    // Fetch both permissions and settings when page loads
    dispatch(fetchDateSettings());
  }, [dispatch]);

  const handleRestrictionTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value as RestrictionType;
    const payload: UpdateRestrictionPayload = { restrictionType: value };
    dispatch(updateOrderDateRestriction(payload));
  };

  const handleDaysValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    const payload: UpdateRestrictionPayload = { daysValue: value };
    dispatch(updateOrderDateRestriction(payload));
  };

  const handleDateRangeChange = (field: 'startDate' | 'endDate', value: string) => {
    const payload: UpdateRestrictionPayload = { [field]: value };
    dispatch(updateOrderDateRestriction(payload));
  };

  const handleExpectedDeliveryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    dispatch(updateExpectedDeliveryDays(value));
  };

  const handleInvoiceRestrictionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value as InvoiceRestrictionType;
    const payload: UpdateInvoicePayload = { type: value };
    dispatch(updateInvoiceRestriction(payload));
  };

  const handleInvoiceDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    const payload: UpdateInvoicePayload = { 
      type: settings?.invoiceDateRestriction || 'any', 
      days: value 
    };
    dispatch(updateInvoiceRestriction(payload));
  };

  const handleSave = async () => {
    if (!settings) return;
    
    try {
      setSaveError('');
      await dispatch(saveDateSettings(settings)).unwrap();
      setSuccessMessage('Date settings saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setSaveError(error.message || 'Failed to save settings');
    }
  };

  const handleReset = () => {
    dispatch(fetchDateSettings());
  };

  const getDateRestrictionPreview = () => {
    if (!settings) return null;
    
    const today = new Date();
    const { restrictionType, daysValue, startDate, endDate } = settings.orderDateRestriction;

    switch (restrictionType) {
      case 'current_only':
        return (
          <Chip 
            icon={<TodayIcon />} 
            label={`Only today's date (${format(today, 'dd/MM/yyyy')})`} 
            color="info" 
            variant="outlined"
          />
        );
      case 'days_before':
        return (
          <Chip 
            icon={<EventAvailableIcon />} 
            label={`Allow dates from ${format(subDays(today, daysValue), 'dd/MM/yyyy')} to today`} 
            color="info" 
            variant="outlined"
          />
        );
      case 'days_after':
        return (
          <Chip 
            icon={<EventAvailableIcon />} 
            label={`Allow dates from today to ${format(addDays(today, daysValue), 'dd/MM/yyyy')}`} 
            color="info" 
            variant="outlined"
          />
        );
      case 'date_range':
        return startDate && endDate ? (
          <Chip 
            icon={<DateRangeIcon />} 
            label={`Allow dates from ${format(new Date(startDate), 'dd/MM/yyyy')} to ${format(new Date(endDate), 'dd/MM/yyyy')}`} 
            color="info" 
            variant="outlined"
          />
        ) : (
          <Chip 
            label="Select start and end dates" 
            color="warning" 
            variant="outlined"
          />
        );
      default:
        return <Chip label="No restrictions (all dates allowed)" color="default" variant="outlined" />;
    }
  };

  if (loading && !settings) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }


  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* Header with Back Button */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton 
          onClick={() => router.push('/yen-settings')}
          sx={{ mr: 2 }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" fontWeight="bold">
          Date Settings
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => dispatch(clearError())}>
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMessage('')}>
          {successMessage}
        </Alert>
      )}

      {saveError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setSaveError('')}>
          {saveError}
        </Alert>
      )}

     

      {settings && (
        <>
          {/* Order Date Settings */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DateRangeIcon color="primary" />
                Order Date Restrictions
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                Control what dates users can select for Purchase Order creation
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <FormControl component="fieldset">
                    <FormLabel component="legend">Restriction Type</FormLabel>
                    <RadioGroup
                      row
                      value={settings.orderDateRestriction.restrictionType}
                      onChange={handleRestrictionTypeChange}
                    >
                      <FormControlLabel 
                        value="no_restriction" 
                        control={<Radio />} 
                        label="No Restriction" 
                      />
                      <FormControlLabel 
                        value="current_only" 
                        control={<Radio />} 
                        label="Current Date Only" 
                     
                      />
                      <FormControlLabel 
                        value="days_before" 
                        control={<Radio />} 
                        label="Days Before Today" 
                   
                      />
                      <FormControlLabel 
                        value="days_after" 
                        control={<Radio />} 
                        label="Days After Today" 
                     
                      />
                      <FormControlLabel 
                        value="date_range" 
                        control={<Radio />} 
                        label="Specific Date Range" 
                        
                      />
                    </RadioGroup>
                  </FormControl>
                </Grid>

                {/* Days input for before/after */}
                {(settings.orderDateRestriction.restrictionType === 'days_before' ||
                  settings.orderDateRestriction.restrictionType === 'days_after') && (
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Number of Days"
                      value={settings.orderDateRestriction.daysValue}
                      onChange={handleDaysValueChange}
                      InputProps={{ inputProps: { min: 1, max: 365 } }}
                      helperText={
                        settings.orderDateRestriction.restrictionType === 'days_before'
                          ? `User can select dates up to ${settings.orderDateRestriction.daysValue} days before today`
                          : `User can select dates up to ${settings.orderDateRestriction.daysValue} days after today`
                      }
                     
                    />
                  </Grid>
                )}

                {/* Date range inputs */}
                {settings.orderDateRestriction.restrictionType === 'date_range' && (
                  <>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="date"
                        label="Start Date"
                        value={settings.orderDateRestriction.startDate?.split('T')[0] || ''}
                        onChange={(e) => handleDateRangeChange('startDate', e.target.value)}
                        InputLabelProps={{ shrink: true }}
                       
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="date"
                        label="End Date"
                        value={settings.orderDateRestriction.endDate?.split('T')[0] || ''}
                        onChange={(e) => handleDateRangeChange('endDate', e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        inputProps={{ 
                          min: settings.orderDateRestriction.startDate?.split('T')[0] 
                        }}
                        
                      />
                    </Grid>
                  </>
                )}

                {/* Preview */}
                <Grid item xs={12}>
                  <Box sx={{ mt: 2, p: 2, bgcolor: '#f9f9f9', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Preview:
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {getDateRestrictionPreview()}
                    </Stack>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Expected Delivery Settings */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EventAvailableIcon color="primary" />
                Expected Delivery Settings
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Default Delivery Days"
                    value={settings.expectedDeliveryDays}
                    onChange={handleExpectedDeliveryChange}
                    InputProps={{ inputProps: { min: 1, max: 365 } }}
                    helperText="Number of days to add to order date for expected delivery"
                
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                    <Typography variant="body2">
                      <strong>Example:</strong> If order date is today ({format(new Date(), 'dd/MM/yyyy')}), 
                      expected delivery will be {format(addDays(new Date(), settings.expectedDeliveryDays), 'dd/MM/yyyy')}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Invoice Date Settings */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EventAvailableIcon color="primary" />
                Invoice Date Settings
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <FormControl component="fieldset">
                    <FormLabel component="legend">Invoice Date Restriction</FormLabel>
                    <RadioGroup
                      row
                      value={settings.invoiceDateRestriction}
                      onChange={handleInvoiceRestrictionChange}
                    >
                      <FormControlLabel 
                        value="any" 
                        control={<Radio />} 
                        label="Any Date" 
                  
                      />
                      <FormControlLabel 
                        value="same_as_order" 
                        control={<Radio />} 
                        label="Same as Order Date" 
              
                      />
                      <FormControlLabel 
                        value="after_order" 
                        control={<Radio />} 
                        label="After Order Date" 
          
                      />
                    </RadioGroup>
                  </FormControl>
                </Grid>

                {settings.invoiceDateRestriction === 'after_order' && (
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Minimum Days After Order"
                      value={settings.invoiceDaysAfterOrder}
                      onChange={handleInvoiceDaysChange}
                      InputProps={{ inputProps: { min: 0, max: 365 } }}
                      helperText="Invoice date must be at least this many days after order date"
          
                    />
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>

          {/* Last Updated Info */}
          {lastUpdated && (
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 2 }}>
              Last updated: {format(new Date(lastUpdated), 'dd/MM/yyyy HH:mm')}
            </Typography>
          )}

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }}>
            <Button
              variant="outlined"
              startIcon={<RestartAltIcon />}
              onClick={handleReset}
              disabled={loading }
            >
              Reset
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={loading}
              size="large"
            >
              {loading ? <CircularProgress size={24} /> : 'Save Settings'}
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
};

export default DateSettingsPage;