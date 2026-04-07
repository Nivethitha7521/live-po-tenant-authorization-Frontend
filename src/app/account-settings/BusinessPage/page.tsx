'use client';
import React, { useState, useEffect, useRef } from 'react'; // Add useRef
import { TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Box, Typography, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Input, Tooltip } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { fetchBusinesses, updateBusiness, addBusiness, fetchShipping, updateShipping, addShipping, addBusinessdetail, updateBusinessdetail, addShippingdetail, updateShippingdetail, selectBusinesses, fetchPhoto, uploadBusinessPhoto } from '@/features/account-setting/businessSlice';
import { AppDispatch } from '@/redux/store';
import { Business, ShippingAddress } from '@/Models/businessModel';
import AccountSettingsPage from '../page';
import { Add, Save, Edit } from '@mui/icons-material';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import Image from 'next/image';
import * as Yup from 'yup';
import { Formik, Form, Field, FormikHelpers } from 'formik';

// Define validation schema using Yup
const phoneValidation = Yup.string()
  .required('Phone number is required')
  .test(
    'is-valid-phone',
    'Invalid phone number (only digits allowed, 10-15 digits)',
    (value) => {
      if (!value) return false;

      // Remove all non-digit characters
      const digitsOnly = value.replace(/\D/g, '');

      // Check if the remaining digits meet length requirements
      return digitsOnly.length >= 10 && digitsOnly.length <= 15;
    }
  );

// In your BusinessPage component
const BusinessSchema = Yup.object().shape({
  companyName: Yup.string().required('Company Name is required'),
  aliasName: Yup.string()
    .required('Alias is required')
    .matches(/^[A-Za-z]{2}$/, 'Alias must be exactly 2 letters (A-Z, a-z)')
    .max(2, 'Alias must be exactly 2 characters')
    .min(2, 'Alias must be exactly 2 characters'),
  address1: Yup.string().required('Address is required'),
  phoneNo: phoneValidation,
  emailId: Yup.string().email('Invalid email').required('Email is required'),
  gstIn: Yup.string().required('GSTIN Required'),
  address2: Yup.string() // Optional field
});
const ShippingSchema = Yup.object().shape({
  address: Yup.string().required('Address is required'),
  phoneNo: phoneValidation,
  emailId: Yup.string().email('Invalid email address').required('Email is required'),
  gstIn: Yup.string().required('GSTIN is required'),
});

const BusinessPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { businesses, shippingaddress, loading } = useSelector(selectBusinesses);
  
  // Refs for scrolling
  const businessRef = useRef<HTMLDivElement>(null);
  const shippingRef = useRef<HTMLDivElement>(null);
  
  // Business State
  const [editBusinessRowId, setEditBusinessRowId] = useState<number | string | null>(null);
  const [updatedBusinessRow, setUpdatedBusinessRow] = useState<any>({});
  // Shipping State
  const [editShippingRowId, setEditShippingRowId] = useState<number | string | null>(null);
  const [updatedShippingRow, setUpdatedShippingRow] = useState<ShippingAddress | null>(null);
  // Dialog States
  const [openBusinessDialog, setOpenBusinessDialog] = useState(false);
  const [openShippingDialog, setOpenShippingDialog] = useState(false);
  const [fetchedBusinessIds, setFetchedBusinessIds] = useState(new Set());

  useEffect(() => {
    dispatch(fetchBusinesses());
    dispatch(fetchShipping());
  }, [dispatch]);

  useEffect(() => {
    businesses.forEach((business) => {
      if (!fetchedBusinessIds.has(business.businessId)) {
        dispatch(fetchPhoto(business.businessId));
        setFetchedBusinessIds(prevSet => new Set(prevSet).add(business.businessId));
      }
    });
  }, [businesses, fetchedBusinessIds, dispatch]);
  
  // Business handlers
  const handleBusinessChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, field: string) => {
    setUpdatedBusinessRow({
      ...updatedBusinessRow,
      [field]: e.target.value
    });
  };

  const handleSaveBusiness = (id: string) => {
    if (updatedBusinessRow) {
      dispatch(updateBusiness({ ...updatedBusinessRow, businessId: id }));
      setEditBusinessRowId(null);  // Exit edit mode
      dispatch(updateBusinessdetail(updatedBusinessRow));
    }
  };

  const handleEditBusiness = (business: Business) => {
    setEditBusinessRowId(business.businessId);
    setUpdatedBusinessRow(business);
    // Scroll to business section when editing
    setTimeout(() => {
      businessRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };
  
  const saveBusinessData = (values: {
    companyName: string;
    aliasName: string;
    address1: string;
    address2: string;
    gstIn: string;
    phoneNo: string;
    emailId: string;
  }) => {
    const newBusinessData: Business = {
      businessId: '',
      companyName: values.companyName,
      aliasName: values.aliasName.toUpperCase(), // Ensure uppercase
      address1: values.address1,
      address2: values.address2,
      emailId: values.emailId,
      phoneNo: values.phoneNo,
      gstIn: values.gstIn,
      createdDate: null,
      lastupdatedDate: null,
      status: 'active',
      randomId: '',
      imageUrl: null,
      isFetched: false
    };

    dispatch(addBusiness(newBusinessData))
      .then((response) => {
        setOpenBusinessDialog(false);
        // Scroll to business section after adding
        setTimeout(() => {
          businessRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      })
      .catch((error) => {
        console.error("Error adding business address:", error);
      });
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, businessId: string) => {
    const file = event.target.files?.[0];
    if (file) {
      dispatch(uploadBusinessPhoto({ businessId, file }));
    }
  };
  
  // Shipping handlers
  const handleShippingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, field: string) => {
    setUpdatedShippingRow({
      ...updatedShippingRow!,
      [field]: e.target.value
    });
  };

  const handleSaveShipping = (id: string) => {
    dispatch(updateShipping({ ...updatedShippingRow!, shippingId: id }))
      .then(() => {
        dispatch(updateShippingdetail(updatedShippingRow));
        setEditShippingRowId(null);
        setUpdatedShippingRow(null);
      })
      .catch((error) => {
        console.error("Error saving shipping address:", error);
      });
  };
  
  const handleEditShipping = (shipping: ShippingAddress) => {
    setEditShippingRowId(shipping.shippingId ?? null);
    setUpdatedShippingRow(shipping);
    // Scroll to shipping section when editing
    setTimeout(() => {
      shippingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const saveShippingAddress = (
    values: {
      shippingId: string;
      address: string;
      phoneNo: string;
      emailId: string;
      gstIn: string;
      randomId: string;
    },
    { setFieldError }: FormikHelpers<{
      shippingId: string;
      address: string;
      phoneNo: string;
      emailId: string;
      gstIn: string;
      randomId: string;
    }>
  ) => {
    // Check for duplicate shipping address
    const isDuplicate = shippingaddress.some(
      (item) => item.address.toLowerCase() === values.address.toLowerCase()
    );

    if (isDuplicate) {
      setFieldError('address', 'This shipping address already exists');
      return;
    }

    const newShippingData: ShippingAddress = {
      shippingId: values.shippingId || `SHIP_${Date.now()}`,
      address: values.address,
      emailId: values.emailId,
      phoneNo: values.phoneNo,
      gstIn: values.gstIn,
      randomId: values.randomId || '',
    };

    dispatch(addShipping(newShippingData))
      .then(() => {
        handleCloseShippingDialog();
        dispatch(fetchShipping());
        // Scroll to shipping section after adding
        setTimeout(() => {
          shippingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      })
      .catch((error) => {
        console.error("Error adding shipping address:", error);
        if (error.response?.data?.errors) {
          Object.entries(error.response.data.errors).forEach(([field, message]) => {
            setFieldError(field, message as string);
          });
        }
      });
  };
  
  const handleNewBusiness = () => {
    setUpdatedBusinessRow({
      businessId: '',
      companyName: '',
      address1: '',
      address2: '',
      emailId: '',
      phoneNo: '',
      gstIn: '',
      aliasName: '', // Add aliasName
    });
    setOpenBusinessDialog(true);
  };

  const handleNewShipping = () => {
    setUpdatedShippingRow({
      shippingId: '',
      address: '',
      phoneNo: '',
      emailId: '',
      gstIn: '',
      randomId: ''
    });
    setOpenShippingDialog(true);
  };

  const handleCloseBusinessDialog = () => {
    setOpenBusinessDialog(false);
    setUpdatedBusinessRow({});
  };

  const handleCloseShippingDialog = () => {
    setOpenShippingDialog(false);
    setUpdatedShippingRow(null);
  };
  
  const getFilteredBusinesses = (businesses: Business[]) => {
    return businesses.filter((business) =>
      business.businessId && business.companyName && business.companyName.trim() !== ''
    );
  };

  return (
    <Box sx={{ height: '100vh', overflow: 'auto', p: 2 }}> {/* Make the main container scrollable */}
      {/* Business Details Section */}
      <Box ref={businessRef} sx={{ mb: 4 }}> {/* Add ref and bottom margin */}
        <Typography variant="h5">Business Information</Typography>
        <Tooltip title="Add New Business" arrow>
          <span>
            <IconButton
              onClick={handleNewBusiness}
              color="primary"
              className='icon-button-outline'
              disabled={businesses.length >= 1}
            >
              <Add />
            </IconButton>
          </span>
        </Tooltip>
        
        {loading ? (
          <Typography>Loading...</Typography>
        ) : businesses.length > 0 ? ( // Fix: use businesses.length instead of getFilteredBusinesses.length
          businesses.map((business: Business) => (
            <Box key={business.businessId} sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Input
                  id={`file-input-${business.businessId}`}
                  type="file"
                  style={{ display: 'none' }}
                  onChange={(e: any) => handleFileChange(e, business.businessId)}
                />
                <label htmlFor={`file-input-${business.businessId}`}>
                  {!business.imageUrl && (
                    <IconButton color="primary" component="span">
                      <CameraAltIcon />
                    </IconButton>
                  )}
                </label>
                {business.imageUrl && (
                  <Image
                    src={business.imageUrl}
                    alt={`Business Photo for ${business.companyName}`}
                    width={100}
                    height={100}
                    style={{ marginTop: '10px' }}
                  />
                )}
              </Box>
              
              <TableContainer component={Paper} style={{ width: '100%', maxWidth: '800px' }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Business Info</TableCell>
                      <TableCell>Details</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>Company Name</TableCell>
                      <TableCell>
                        {editBusinessRowId === business.businessId ? (
                          <TextField
                            autoComplete='off'
                            value={updatedBusinessRow.companyName || ''}
                            onChange={(e) => handleBusinessChange(e, 'companyName')}
                            size="small"
                          />
                        ) : (
                          business.companyName
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Alias</TableCell>
                      <TableCell>
                        {editBusinessRowId === business.businessId ? (
                          <TextField
                            autoComplete='off'
                            value={updatedBusinessRow.aliasName || ''}
                            onChange={(e) => {
                              const value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
                              handleBusinessChange({ target: { value } } as any, 'aliasName');
                            }}
                            size="small"
                            inputProps={{
                              maxLength: 2,
                              style: { textTransform: 'uppercase' }
                            }}
                            placeholder="AA"
                          />
                        ) : (
                          <strong style={{ fontSize: '1em'}}>
                            {business.aliasName || '--'}
                          </strong>
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Address 1</TableCell>
                      <TableCell>
                        {editBusinessRowId === business.businessId ? (
                          <TextField
                            autoComplete='off'
                            value={updatedBusinessRow.address1 || ''}
                            onChange={(e) => handleBusinessChange(e, 'address1')}
                            size="small"
                          />
                        ) : (
                          business.address1
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Address 2</TableCell>
                      <TableCell>
                        {editBusinessRowId === business.businessId ? (
                          <TextField
                            autoComplete='off'
                            value={updatedBusinessRow.address2 || ''}
                            onChange={(e) => handleBusinessChange(e, 'address2')}
                            size="small"
                          />
                        ) : (
                          business.address2 || 'N/A'
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Email</TableCell>
                      <TableCell>
                        {editBusinessRowId === business.businessId ? (
                          <TextField
                            autoComplete='off'
                            value={updatedBusinessRow.emailId || ''}
                            onChange={(e) => handleBusinessChange(e, 'emailId')}
                            size="small"
                          />
                        ) : (
                          business.emailId
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>GSTIN</TableCell>
                      <TableCell>
                        {editBusinessRowId === business.businessId ? (
                          <TextField
                            autoComplete='off'
                            value={updatedBusinessRow.gstIn || ''}
                            onChange={(e) => handleBusinessChange(e, 'gstIn')}
                            size="small"
                          />
                        ) : (
                          business.gstIn || 'N/A'
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Phone No</TableCell>
                      <TableCell>
                        {editBusinessRowId === business.businessId ? (
                          <TextField
                            autoComplete='off'
                            value={updatedBusinessRow.phoneNo || ''}
                            onChange={(e) => handleBusinessChange(e, 'phoneNo')}
                            size="small"
                          />
                        ) : (
                          business.phoneNo
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <Box sx={{ p: 1 }}>
                  {editBusinessRowId === business.businessId ? (
                    <Tooltip title='Save'>
                      <IconButton color='primary' onClick={() => handleSaveBusiness(business.businessId)}>
                        <Save />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Tooltip title='Edit'>
                      <IconButton color='primary' onClick={() => handleEditBusiness(business)}>
                        <Edit />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </TableContainer>
            </Box>
          ))
        ) : (
          <Typography>No businesses found</Typography>
        )}
      </Box>

      {/* Shipping Details Section */}
      <Box ref={shippingRef} sx={{ mt: 4 }}> {/* Add ref and top margin */}
        <Typography variant="h5">Shipping Addresses</Typography>
        <Tooltip title="Add New Shipping Address" arrow>
          <span>
            <IconButton
              onClick={handleNewShipping}
              color="primary"
              className='icon-button-outline'
            >
              <Add />
            </IconButton>
          </span>
        </Tooltip>
        
        {loading ? (
          <Typography>Loading...</Typography>
        ) : shippingaddress.length > 0 ? (
          <TableContainer component={Paper} sx={{ mt: 2, width: '100%', maxWidth: '1000px' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Address</TableCell>
                  <TableCell>Mobile</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>GSTIN</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {shippingaddress.map((shipping: ShippingAddress) => (
                  <TableRow key={shipping.shippingId}>
                    <TableCell>
                      {editShippingRowId === shipping.shippingId ? (
                        <TextField
                          autoComplete='off'
                          value={updatedShippingRow?.address || ''}
                          onChange={(e) => handleShippingChange(e, 'address')}
                          size="small"
                        />
                      ) : (
                        shipping.address
                      )}
                    </TableCell>
                    <TableCell>
                      {editShippingRowId === shipping.shippingId ? (
                        <TextField
                          autoComplete='off'
                          value={updatedShippingRow?.phoneNo || ''}
                          onChange={(e) => handleShippingChange(e, 'phoneNo')}
                          size="small"
                        />
                      ) : (
                        shipping.phoneNo
                      )}
                    </TableCell>
                    <TableCell>
                      {editShippingRowId === shipping.shippingId ? (
                        <TextField
                          autoComplete='off'
                          value={updatedShippingRow?.emailId || ''}
                          onChange={(e) => handleShippingChange(e, 'emailId')}
                          size="small"
                        />
                      ) : (
                        shipping.emailId
                      )}
                    </TableCell>
                    <TableCell>
                      {editShippingRowId === shipping.shippingId ? (
                        <TextField
                          autoComplete='off'
                          value={updatedShippingRow?.gstIn || ''}
                          onChange={(e) => handleShippingChange(e, 'gstIn')}
                          size="small"
                        />
                      ) : (
                        shipping.gstIn
                      )}
                    </TableCell>
                    <TableCell>
                      {editShippingRowId === shipping.shippingId ? (
                        <Tooltip title='Save'>
                          <IconButton color='primary' onClick={() => handleSaveShipping(shipping.shippingId!)}>
                            <Save />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Tooltip title='Edit'>
                          <IconButton color='primary' onClick={() => handleEditShipping(shipping)}>
                            <Edit />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography>No shipping addresses found</Typography>
        )}
      </Box>

      {/* Add Business Dialog */}
      <Dialog open={openBusinessDialog} onClose={handleCloseBusinessDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Business</DialogTitle>
        <Formik
          initialValues={{
            companyName: '',
            address1: '',
            address2: '',
            gstIn: '',
            phoneNo: '',
            emailId: '',
            aliasName: '',
          }}
          validationSchema={BusinessSchema}
          onSubmit={(values, { setSubmitting }) => {
            saveBusinessData(values);
            setSubmitting(false);
          }}
        >
          {({ errors, touched, isSubmitting, setFieldValue }) => ( // Added setFieldValue here
            <Form>
              <DialogContent>
                <Field
                  name="companyName"
                  as={TextField}
                  label="Company Name"
                  fullWidth
                  margin="normal"
                  error={touched.companyName && !!errors.companyName}
                  helperText={touched.companyName && errors.companyName}
                  autoComplete="off"
                  size="small"
                />
                <Field
                  name="aliasName"
                  as={TextField}
                  label="Alias (2 Letters)"
                  fullWidth
                  margin="normal"
                  error={touched.aliasName && !!errors.aliasName}
                  helperText={touched.aliasName && errors.aliasName}
                  autoComplete="off"
                  inputProps={{
                    maxLength: 2,
                    style: { textTransform: 'uppercase' }
                  }}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
                    setFieldValue('aliasName', value);
                  }}
                  size="small"
                />
                <Field
                  name="address1"
                  as={TextField}
                  label="Address"
                  fullWidth
                  margin="normal"
                  error={touched.address1 && !!errors.address1}
                  helperText={touched.address1 && errors.address1}
                  autoComplete="off"
                  size="small"
                />
                <Field
                  name="phoneNo"
                  as={TextField}
                  label="Phone"
                  fullWidth
                  margin="normal"
                  error={touched.phoneNo && !!errors.phoneNo}
                  helperText={touched.phoneNo && errors.phoneNo}
                  autoComplete="off"
                  size="small"
                />
                <Field
                  name="emailId"
                  as={TextField}
                  label="Email"
                  fullWidth
                  margin="normal"
                  error={touched.emailId && !!errors.emailId}
                  helperText={touched.emailId && errors.emailId}
                  autoComplete="off"
                  size="small"
                />
                <Field
                  name="gstIn"
                  as={TextField}
                  label="GSTIN"
                  fullWidth
                  margin="normal"
                  error={touched.gstIn && !!errors.gstIn}
                  helperText={touched.gstIn && errors.gstIn}
                  autoComplete="off"
                  size="small"
                />
                <Field
                  name="address2"
                  as={TextField}
                  label="Address 2"
                  fullWidth
                  margin="normal"
                  autoComplete="off"
                  size="small"
                />
              </DialogContent>
              <DialogActions>
                <Button onClick={handleCloseBusinessDialog} color="primary">
                  Cancel
                </Button>
                <Button type="submit" color="primary" disabled={isSubmitting}>
                  Save
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>

      {/* Add Shipping Dialog */}
      <Dialog open={openShippingDialog} onClose={handleCloseShippingDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Shipping Address</DialogTitle>
        <Formik
          initialValues={{
            shippingId: '',
            address: '',
            phoneNo: '',
            emailId: '',
            gstIn: '',
            randomId: ''
          }}
          validationSchema={ShippingSchema}
          onSubmit={saveShippingAddress}
        >
          {({ handleSubmit, setFieldError, touched, errors }) => (
            <Form onSubmit={handleSubmit}>
              <DialogContent>
                <Field
                  name="address"
                  autoComplete='off'
                  as={TextField}
                  label="Address"
                  fullWidth
                  margin="normal"
                  error={touched.address && !!errors.address}
                  helperText={touched.address && errors.address}
                  size="small"
                />
                <Field
                  name="phoneNo"
                  autoComplete='off'
                  as={TextField}
                  label="Phone No"
                  fullWidth
                  margin="normal"
                  error={touched.phoneNo && !!errors.phoneNo}
                  helperText={touched.phoneNo && errors.phoneNo}
                  size="small"
                />
                <Field
                  name="emailId"
                  autoComplete='off'
                  as={TextField}
                  label="Email ID"
                  fullWidth
                  margin="normal"
                  error={touched.emailId && !!errors.emailId}
                  helperText={touched.emailId && errors.emailId}
                  size="small"
                />
                <Field
                  name="gstIn"
                  autoComplete='off'
                  as={TextField}
                  label="GSTIN"
                  fullWidth
                  margin="normal"
                  error={touched.gstIn && !!errors.gstIn}
                  helperText={touched.gstIn && errors.gstIn}
                  size="small"
                />
              </DialogContent>
              <DialogActions>
                <Button onClick={handleCloseShippingDialog} color="primary">
                  Cancel
                </Button>
                <Button type="submit" color="primary">
                  Save
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>
    </Box>
  );
};

export default BusinessPage;