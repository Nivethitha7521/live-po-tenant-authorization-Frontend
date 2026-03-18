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
  Divider,
  FormControl,
  Container
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
  updateExpectedDeliveryRestriction,
  updateInvoiceDateRestriction,
  updateExpectedDeliveryDays,
  updateInvoiceDaysAfterOrder,
  clearError
} from '../Features/PurchaseDateSettingSlice';
import { format, addDays, subDays } from 'date-fns';
import { useRouter } from 'next/navigation';
import { RestrictionType, UpdateRestrictionPayload } from '../Models/Datesetting';

const DateSettingsPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();

  const { settings, loading, error, lastUpdated } = useSelector(
    (state: RootState) => state.purchaseDateSettings
  );

  const role = useSelector((state: RootState) => state.auth.role);

 

  const [successMessage, setSuccessMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    dispatch(fetchDateSettings());
  }, [dispatch]);
 // Block non-admin
  if (role !== "Admin") {
    return (
      <Box sx={{ p: 4, textAlign: "center", mt: 8 }}>
        <Typography variant="h5" color="error" gutterBottom>
          Access Denied
        </Typography>
        <Typography color="textSecondary">
          You don&apos;t have permission to access this page
        </Typography>
        <Button sx={{ mt: 2 }} variant="contained" onClick={() => router.push("/")}>
          Go Dashboard
        </Button>
      </Box>
    );
  }
  // Generic handler for restriction changes
  const handleRestrictionChange = (
    restrictionType: 'order' | 'expected' | 'invoice',
    field: keyof UpdateRestrictionPayload,
    value: any
  ) => {
    const payload: UpdateRestrictionPayload = { [field]: value };

    switch (restrictionType) {
      case 'order':
        dispatch(updateOrderDateRestriction(payload));
        break;
      case 'expected':
        dispatch(updateExpectedDeliveryRestriction(payload));
        break;
      case 'invoice':
        dispatch(updateInvoiceDateRestriction(payload));
        break;
    }
  };

  const handleRestrictionTypeChange = (
    restrictionType: 'order' | 'expected' | 'invoice',
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value as RestrictionType;
    handleRestrictionChange(restrictionType, 'restrictionType', value);
  };

  const handleDaysValueChange = (
    restrictionType: 'order' | 'expected' | 'invoice',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = parseInt(e.target.value) || 0;
    handleRestrictionChange(restrictionType, 'daysValue', value);
  };

  const handleDateRangeChange = (
    restrictionType: 'order' | 'expected' | 'invoice',
    field: 'startDate' | 'endDate',
    value: string
  ) => {
    handleRestrictionChange(restrictionType, field, value);
  };

const handleSave = async () => {
  if (!settings) return;

  try {
    setSaveError('');
    
    // Log what we're saving
    console.log('💾 Saving settings:', settings);
    
    // Call PATCH endpoint (uses Redux loading state automatically)
    const result = await dispatch(saveDateSettings(settings)).unwrap();
    
    console.log('✅ Save successful:', result);
    setSuccessMessage('Date settings saved successfully!');
    
    // Refresh data to ensure UI is in sync
    await dispatch(fetchDateSettings());
    
    setTimeout(() => setSuccessMessage(''), 3000);
  } catch (error: any) {
    console.error('❌ Save failed:', error);
    setSaveError(error.message || 'Failed to save settings');
  }
  // No finally block needed - Redux manages loading state
};
  const handleReset = () => {
    dispatch(fetchDateSettings());
  };

  const getRestrictionPreview = (restriction: any) => {
    if (!restriction) return null;

    const today = new Date();
    const { restrictionType, daysValue, startDate, endDate } = restriction;

    switch (restrictionType) {
      case 'current_only':
        return (
          <Chip
            icon={<TodayIcon />}
            label={`Only today's date (${format(today, 'dd/MM/yyyy')})`}
            color="info"
            variant="outlined"
            size="small"
          />
        );
      case 'days_before':
        return (
          <Chip
            icon={<EventAvailableIcon />}
            label={`From ${format(subDays(today, daysValue), 'dd/MM/yyyy')} to today`}
            color="info"
            variant="outlined"
            size="small"
          />
        );
      case 'days_after':
        return (
          <Chip
            icon={<EventAvailableIcon />}
            label={`From today to ${format(addDays(today, daysValue), 'dd/MM/yyyy')}`}
            color="info"
            variant="outlined"
            size="small"
          />
        );
      case 'date_range':
        return startDate && endDate ? (
          <Chip
            icon={<DateRangeIcon />}
            label={`${format(new Date(startDate), 'dd/MM/yyyy')} to ${format(new Date(endDate), 'dd/MM/yyyy')}`}
            color="info"
            variant="outlined"
            size="small"
          />
        ) : (
          <Chip label="Select date range" color="warning" variant="outlined" size="small" />
        );
      default:
        return <Chip label="No restrictions" color="default" variant="outlined" size="small" />;
    }
  };

  const renderRestrictionCard = (
    title: string,
    icon: React.ReactNode,
    restrictionType: 'order' | 'expected' | 'invoice',
    restriction: any,
    showDaysInput: boolean = true,
    showDateRange: boolean = true
  ) => {
    if (!restriction) return null;

    return (
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
            {icon}
            {title}
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl component="fieldset" size="small">
                <RadioGroup
                  row
                  value={restriction.restrictionType}
                  onChange={(e) => handleRestrictionTypeChange(restrictionType, e)}
                  sx={{ flexWrap: 'wrap', gap: 1 }}
                >
                  <FormControlLabel value="no_restriction" control={<Radio size="small" />} label={<Typography variant="body2">No Restriction</Typography>} />
                  <FormControlLabel value="current_only" control={<Radio size="small" />} label={<Typography variant="body2">Current Date Only</Typography>} />
                  <FormControlLabel value="days_before" control={<Radio size="small" />} label={<Typography variant="body2">Days Before</Typography>} />
                  <FormControlLabel value="days_after" control={<Radio size="small" />} label={<Typography variant="body2">Days After</Typography>} />
                  <FormControlLabel value="date_range" control={<Radio size="small" />} label={<Typography variant="body2">Date Range</Typography>} />
                </RadioGroup>
              </FormControl>
            </Grid>

            {/* Days input for before/after */}
            {(restriction.restrictionType === 'days_before' || restriction.restrictionType === 'days_after') && showDaysInput && (
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  autoComplete='false'
                  size="small"
                  type="number"
                  label="Number of Days"
                  value={restriction.daysValue}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleDaysValueChange(restrictionType, e)}
                  InputProps={{ inputProps: { min: 1, max: 365 } }}
                />
              </Grid>
            )}

            {/* Date range inputs */}
            {restriction.restrictionType === 'date_range' && showDateRange && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    autoComplete='false'
                    size="small"
                    type="date"
                    label="Start Date"
                    value={restriction.startDate?.split('T')[0] || ''}
                    onChange={(e) => handleDateRangeChange(restrictionType, 'startDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    autoComplete='off'
                    size="small"
                    type="date"
                    label="End Date"
                    value={restriction.endDate?.split('T')[0] || ''}
                    onChange={(e) => handleDateRangeChange(restrictionType, 'endDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{
                      min: restriction.startDate?.split('T')[0]
                    }}
                  />
                </Grid>
              </>
            )}

            {/* Preview */}
            <Grid item xs={12}>
              <Box sx={{ mt: 1, p: 1.5, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="caption" color="textSecondary" gutterBottom>
                  Preview:
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  {getRestrictionPreview(restriction)}
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    );
  };

  if (loading && !settings) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: '#f5f5f5',
      overflow: 'hidden'
    }}>
      {/* Fixed Header */}
      <Box sx={{ 
        p: 2, 
        bgcolor: 'white', 
        borderBottom: 1, 
        borderColor: 'divider',
        boxShadow: 1,
        zIndex: 10
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', maxWidth: 1200, mx: 'auto' }}>
          <IconButton onClick={() => router.push('/yen-settings')} sx={{ mr: 2 }} size="small">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" fontWeight="bold">
            Date Settings
          </Typography>
        </Box>
      </Box>

      {/* Scrollable Content */}
      <Box sx={{ 
        flex: 1,
        overflow: 'auto',
        p: 2
      }}>
        <Container maxWidth="lg" sx={{ height: '100%' }}>
          {/* Alerts */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearError())} >
              {error}
            </Alert>
          )}
          {successMessage && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage('')}>
              {successMessage}
            </Alert>
          )}
          {saveError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError('')}>
              {saveError}
            </Alert>
          )}

          {settings && (
            <>
              {/* Order Date Settings */}
              {renderRestrictionCard(
                'Order Date',
                <DateRangeIcon color="primary" fontSize="small" />,
                'order',
                settings.orderDateRestriction
              )}

              {/* Expected Delivery Settings */}
              {renderRestrictionCard(
                'Expected Delivery',
                <EventAvailableIcon color="primary" fontSize="small" />,
                'expected',
                settings.expectedDeliveryRestriction
              )}

              {/* Additional Expected Delivery Days Input */}
              <Card sx={{ mb: 2 }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                    Default Delivery Days
                  </Typography>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="Days to Add"
                        value={settings.expectedDeliveryDays}
                        onChange={(e) => dispatch(updateExpectedDeliveryDays(parseInt(e.target.value) || 0))}
                        InputProps={{ inputProps: { min: 1, max: 365 } }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="textSecondary">
                        Example: Order today + {settings.expectedDeliveryDays} days ={' '}
                        <strong>{format(addDays(new Date(), settings.expectedDeliveryDays), 'dd/MM/yyyy')}</strong>
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Invoice Date Settings */}
              {renderRestrictionCard(
                'Invoice Date',
                <EventAvailableIcon color="primary" fontSize="small" />,
                'invoice',
                settings.invoiceDateRestriction
              )}

              {/* Additional Invoice Days Input */}
              <Card sx={{ mb: 2 }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                    Minimum Invoice Days After Order
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="Days After Order"
                        value={settings.invoiceDaysAfterOrder}
                        onChange={(e) => dispatch(updateInvoiceDaysAfterOrder(parseInt(e.target.value) || 0))}
                        InputProps={{ inputProps: { min: 0, max: 365 } }}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Last Updated */}
              {lastUpdated && (
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 2 }}>
                  Last updated: {format(new Date(lastUpdated), 'dd/MM/yyyy HH:mm')}
                </Typography>
              )}

              {/* Action Buttons - Fixed at bottom */}
              <Box sx={{ 
                position: 'sticky',
                bottom: 16,
                display: 'flex',
                gap: 1,
                justifyContent: 'flex-end',
                bgcolor: 'white',
                p: 2,
                borderRadius: 1,
                boxShadow: 3,
                zIndex: 5
              }}>
                <Button
                  variant="outlined"
                  startIcon={<RestartAltIcon />}
                  onClick={handleReset}
                  disabled={loading}
                  size="small"
                >
                  Reset
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<SaveIcon />}
                  onClick={handleSave}
                  disabled={loading}
                  size="small"
                >
                  {loading ? <CircularProgress size={20} /> : 'Save'}
                </Button>
              </Box>
            </>
          )}
        </Container>
      </Box>
    </Box>
  );
};

export default DateSettingsPage;