'use client';
import React, { useState, useEffect } from 'react';
import { TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Box, Typography, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Input, Tooltip} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { fetchBusinesses, updateBusiness, addBusiness, fetchShipping, updateShipping, addShipping, addBusinessdetail, updateBusinessdetail, addShippingdetail, updateShippingdetail, selectBusinesses, fetchPhoto, uploadBusinessPhoto } from '@/features/account-setting/businessSlice';
import { AppDispatch } from '@/redux/store';
import { Business, ShippingAddress } from '@/Models/businessModel';
import AccountSettingsPage from '../page';
import { Add, Save,Edit } from '@mui/icons-material';
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

const BusinessSchema = Yup.object().shape({
  companyName: Yup.string().required('Company Name is required'),
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
  };
  const saveBusinessData = (values: {
    address1: string;
    companyName: string;
    address2: string;
    gstIn: string;
    phoneNo: string;
    emailId: string;
  }) => {
    const newBusinessData: Business = {
      businessId: '', // Assume an empty ID until saved
      companyName: values.companyName,
      address1: values.address1,
      address2: values.address2,
      emailId: values.emailId,
      phoneNo: values.phoneNo,
      gstIn: values.gstIn, // Ensure gstIn is included in the payload
      createdDate: null, // Set if needed
      lastupdatedDate: null, // Set if needed
      status: 'active', // Default active status
      randomId: '', // Random ID generation
      imageUrl: null, // Set if you need to manage images
      isFetched: false // Set to false as the item is new
    };

    // Dispatch the async action to save the business data in the backend
    dispatch(addBusiness(newBusinessData))
      .then((response) => {
        setOpenBusinessDialog(false); // Close the dialog
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
        // After successful update, reset the editing state
        setEditShippingRowId(null);
        setUpdatedShippingRow(null);
        // Optionally, you can fetch the updated list from the server or update the local state
      })
      .catch((error) => {
        console.error("Error saving shipping address:", error);
        // Handle the error if needed
      });
  };
  const handleEditShipping = (shipping: ShippingAddress) => {
    setEditShippingRowId(shipping.shippingId ?? null); // Use null if shippingId is undefined
    setUpdatedShippingRow(shipping);
  };

  const saveShippingAddress = (
    values: ShippingAddress, 
    { setFieldError }: FormikHelpers<ShippingAddress>
  ) => {
      // Check for duplicate shipping address
    const isDuplicate = shippingaddress.some(
      (item) => item.address.toLowerCase() === values.address.toLowerCase()
    );
  
    if (isDuplicate) {
      setFieldError('address', 'This shipping address already exists');
      return; // Prevent form submission
    }
  
    const newShippingData: ShippingAddress = {
      shippingId: '', // Generate unique ID
      address: values.address,
      emailId: values.emailId,
      phoneNo: values.phoneNo,
      gstIn: values.gstIn,
      randomId: '', // Assuming randomId logic is handled here
    };
    dispatch(addShipping(newShippingData))
      .then(() => {
        handleCloseShippingDialog();
        // Fetch shipping addresses again to reflect the newly added data
        dispatch(fetchShipping());
      })
      .catch((error) => {
        console.error("Error adding shipping address:", error);
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
    setUpdatedBusinessRow({}); // Reset the form data
  };

  const handleCloseShippingDialog = () => {
    setOpenShippingDialog(false);
    setUpdatedShippingRow(null); // Reset the shipping data
  };
  const getFilteredBusinesses = (businesses: Business[]) => {
    return businesses.filter((business) =>
      business.businessId && business.companyName && business.companyName.trim() !== ''
    );
  };

  return (
    <Box>
      <AccountSettingsPage />
        {/* Business Details Section */}
        <Box sx={{ ml: 2 }}>
          <Typography variant="h5">Business Information</Typography>
          <Tooltip title="Add New Business" arrow>
      <span>
        <IconButton
          onClick={handleNewBusiness}
          color="primary"
          className='icon-button-outline'
          disabled={businesses.length >= 1} // Disable the button if 1 or more businesses have been added
        >
          <Add/>
        </IconButton>
      </span>
    </Tooltip>
          {loading ? (
            <Typography>Loading...</Typography>
          ) : getFilteredBusinesses.length > 0 ? (
            businesses.map((business: Business) => (
              <Box key={business.businessId} >
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
                    width={100} // specify the width
                    height={100} // specify the height
                    style={{ marginTop: '10px' }} // optional: add styles as needed
                  />
                )}
                <TableContainer component={Paper} style={{ marginTop: '20px', width: '40%' }}>
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
                              style={{ width: '120px' }}  // Fixed width of 120px
                              InputProps={{
                                style: { padding: '0px' }
                              }}
                            />
                          ) : (
                            business.companyName
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
                              style={{ width: '120px' }}  // Fixed width of 120px
                              InputProps={{
                                style: { padding: '0px' }
                              }}
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
                              style={{ width: '120px' }}  // Fixed width of 120px
                              InputProps={{
                                style: { padding: '0px' }
                              }}
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
                              style={{ width: '120px' }}  // Fixed width of 120px
                              InputProps={{
                                style: { padding: '0px' }
                              }}
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
                              style={{ width: '120px' }}  // Fixed width of 120px
                              InputProps={{
                                style: { padding: '0px' }
                              }}
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
                              style={{ width: '120px' }}  // Fixed width of 120px
                              InputProps={{
                                style: { padding: '0px' }
                              }}
                            />
                          ) : (
                            business.phoneNo
                          )}
                        </TableCell>
                      </TableRow>
                    </TableBody>

                  </Table>
                  {editBusinessRowId === business.businessId ? (
                    <Tooltip title='Save'>
                    <IconButton color='primary' onClick={() => handleSaveBusiness(business.businessId)}><Save/></IconButton>
                    </Tooltip>
                  ) : (
                    <Tooltip title='Edit'>
                        <IconButton color='primary' onClick={() => handleEditBusiness(business)}><Edit/></IconButton>
                    </Tooltip>
                  )}

                </TableContainer>
              </Box>
            ))
          ) : (
            <Typography>No businesses found</Typography>
          )}
          {/* Shipping Details Section */}
          <Typography variant="h5" marginTop="40px">Shipping Addresses</Typography>
          <Tooltip title="Add New Business" arrow>
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
            <>
              {/* Table Header (Displayed Only Once) */}
              <TableContainer component={Paper} sx={{ marginTop: '20px' }}>
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
                    {/* Shipping Address Rows */}
                    {shippingaddress.map((shipping: ShippingAddress) => (
                      <TableRow key={shipping.shippingId}>
                        <TableCell>
                          {editShippingRowId === shipping.shippingId ? (
                            <TextField
                              autoComplete='off'
                              value={updatedShippingRow?.address || ''}
                              onChange={(e) => handleShippingChange(e, 'address')}
                              fullWidth
                              InputProps={{
                                style: { padding: '0px' }
                              }}
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
                              fullWidth
                              InputProps={{
                                style: { padding: '0px' }
                              }}
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
                              fullWidth
                              InputProps={{
                                style: { padding: '0px' }
                              }}
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
                              fullWidth
                              InputProps={{
                                style: { padding: '0px' }
                              }}
                            />
                          ) : (
                            shipping.gstIn
                          )}
                        </TableCell>
                        <TableCell>
                          {editShippingRowId === shipping.shippingId ? (
                            <Tooltip title='Save'>
                            <IconButton color='primary' onClick={() => handleSaveShipping(shipping.shippingId!)}><Save/></IconButton>
                            </Tooltip>
                          ) : (
                            <Tooltip title='Edit'>
                              <IconButton color='primary' onClick={() => handleEditShipping(shipping)}><Edit/></IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          ) : (
            <Typography>No shipping addresses found</Typography>
          )}
    <Dialog open={openBusinessDialog} onClose={handleCloseBusinessDialog}>
      <DialogTitle>Add New Business</DialogTitle>
      <Formik
        initialValues={{
          companyName: '',
          address1: '',
          address2: '',
          gstIn:'',
          phoneNo: '',
          emailId: '',
        }}
        validationSchema={BusinessSchema}
        onSubmit={(values, { setSubmitting }) => {
          saveBusinessData(values); // Pass the form data to your save function
          setSubmitting(false); // Stop the form submission state
        }}
      >
        {({ errors, touched, isSubmitting }) => (
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
              />
              <Field
                name="address2"
                as={TextField}
                label="Address 2"
                fullWidth
                margin="normal"
                autoComplete="off"
                // Address2 is optional so no need for error handling here
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
    <Dialog open={openShippingDialog} onClose={handleCloseShippingDialog}>
  <DialogTitle>Add New Shipping Address</DialogTitle>
  <Formik
    initialValues={{
      address: '',
      phoneNo: '',
      emailId: '',
      gstIn: '',
      randomId:''
    }}
    validationSchema={ShippingSchema} // Assuming you have your validation schema
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
            error={touched.address && !!errors.address} // Show error if touched and there is an error
            helperText={touched.address && errors.address} // Display the error message
          />
          <Field
            name="phoneNo"
            autoComplete='off'
            as={TextField}
            label="Phone No"
            fullWidth
            margin="normal"
            error={touched.phoneNo && !!errors.phoneNo} // Error handling for phoneNo
            helperText={touched.phoneNo && errors.phoneNo} // Display the phoneNo error message
          />
          <Field
            name="emailId"
            Autocomplete='off'
            as={TextField}
            label="Email ID"
            fullWidth
            margin="normal"
            error={touched.emailId && !!errors.emailId} // Error handling for emailId
            helperText={touched.emailId && errors.emailId} // Display the emailId error message
          />
          <Field
            name="gstIn"
            autoComplete='off'
            as={TextField}
            label="GSTIN"
            fullWidth
            margin="normal"
            error={touched.gstIn && !!errors.gstIn} // Error handling for gstIn
            helperText={touched.gstIn && errors.gstIn} // Display the gstIn error message
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
    </Box>
  );
};

export default BusinessPage;
