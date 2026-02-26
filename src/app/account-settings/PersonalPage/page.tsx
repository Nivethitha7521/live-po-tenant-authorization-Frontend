"use client";
import React, { useState, useEffect } from "react";
import {
  TextField,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
} from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchPersonals,
  updatePersonal,
  addPersonal,
  selectPersonals,
  addPersonaldetail,
  updatePersonaldetail,
} from "@/features/account-setting/personalSlice";
import AccountSettingsPage from "../page";
import { Add, Save, Edit } from "@mui/icons-material";
import { AppDispatch } from "@/redux/store";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";

// Define validation schema using Yup
const phoneValidation = Yup.string()
  .required("Phone number is required")
  .test(
    "is-valid-phone",
    "Invalid phone number (only digits allowed, 10-15 digits)",
    (value) => {
      if (!value) return false;

      // Remove all non-digit characters
      const digitsOnly = value.replace(/\D/g, "");

      // Check if the remaining digits meet length requirements
      return digitsOnly.length >= 10 && digitsOnly.length <= 15;
    },
  );

// Validation schema using Yup
const validationSchema = Yup.object({
  ownerName: Yup.string().required("Owner name is required"),
  email: Yup.string()
    .email("Invalid email format")
    .required("Email is required"),
  mobileNo: phoneValidation,
});

const PersonalPage = () => {
  const dispatch = useDispatch<AppDispatch>();

  // Fetch personal items from the store
  const { personalitems } = useSelector(selectPersonals);

  // State for dialog and selected personal data for editing
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedPersonal, setSelectedPersonal] = useState<any | null>(null);
  const [loading, setLoading] = useState(false); // Loading state for the form

  // Fetch personals when the component mounts
  useEffect(() => {
    dispatch(fetchPersonals());
  }, [dispatch]);

  const savePersonalData = async (values: any) => {
    setLoading(true); // Set loading state to true when starting the request

    const newPersonalData = {
      personalId: selectedPersonal ? selectedPersonal.personalId : "",
      personName: values.ownerName,
      email: values.email,
      phoneNo: values.mobileNo,
      createdDate: selectedPersonal ? selectedPersonal.createdDate : null,
      lastupdatedDate: null,
      status: "active",
      randomId: selectedPersonal ? selectedPersonal.randomId : null,
    };

    try {
      if (selectedPersonal) {
        // Update existing data
        await dispatch(updatePersonal(newPersonalData));
        dispatch(updatePersonaldetail(newPersonalData)); // Optimistic UI update for updating data
      } else {
        // Add new personal data
        await dispatch(addPersonaldetail(newPersonalData));
        dispatch(addPersonal(newPersonalData));
      }
      setOpenDialog(false); // Close the dialog after saving
    } catch (error) {
      console.error("Error saving personal data:", error);
    } finally {
      setLoading(false); // Reset loading state after the operation completes
    }
  };

  // Reset the form fields
  const resetForm = () => {
    setSelectedPersonal(null); // Reset selected personal data
  };

  // Open Dialog for Add or Edit
  const handleOpenDialog = (personal: any | null = null) => {
    if (personal) {
      // Edit existing personal data
      setSelectedPersonal(personal);
    } else {
      // Add new personal data
      resetForm(); // Reset form to blank
    }
    setOpenDialog(true); // Open dialog
  };

  // Close Dialog
  const handleCloseDialog = () => {
    setOpenDialog(false);
    resetForm();
  };

  return (
    <Box>
      <Box style={{ padding: "2px" }} sx={{ ml: 2 }}>
        <Typography variant="h5">Personal Information</Typography>

        {/* Add New Button (disable if personal info already exists) */}
        <Tooltip title="Add Personal Detail">
          <IconButton
            color="primary"
            className="icon-button-outline"
            onClick={() => handleOpenDialog(null)}
            disabled={personalitems.length === 1} // Allow adding personal info only if no personal data exists
          >
            <Add />
          </IconButton>
        </Tooltip>

        {/* Show fetched personal data */}
        {loading ? (
          <Typography>Loading...</Typography>
        ) : personalitems.length > 0 ? (
          personalitems
            .filter(
              (personal) =>
                personal &&
                personal.personName &&
                personal.email &&
                personal.phoneNo,
            )
            .map((personal) => (
              <TableContainer
                component={Paper}
                key={personal.personalId}
                style={{ marginTop: "20px", width: "50%" }}
              >
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <Typography variant="h6" style={{ fontWeight: "bold" }}>
                          Personal Info
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="h6" style={{ fontWeight: "bold" }}>
                          Details
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell variant="head">
                        <Typography variant="body1">Owner Name:</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1">
                          {personal.personName}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell variant="head">
                        <Typography variant="body1">Email:</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1">
                          {personal.email}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell variant="head">
                        <Typography variant="body1">Mobile No:</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1">
                          {personal.phoneNo}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell variant="head"></TableCell>
                      <TableCell>
                        <Tooltip title="Edit">
                          <IconButton
                            color="primary"
                            onClick={() => handleOpenDialog(personal)}
                            style={{ marginTop: "10px" }}
                          >
                            <Edit />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            ))
        ) : (
          <Typography>No personal info available.</Typography>
        )}

        {/* Dialog for adding/editing personal info */}
        <Dialog open={openDialog} onClose={handleCloseDialog}>
          <DialogTitle>
            {selectedPersonal ? "Edit Personal Info" : "Add Personal Info"}
          </DialogTitle>
          <DialogContent>
            <Formik
              initialValues={{
                ownerName: selectedPersonal ? selectedPersonal.personName : "",
                email: selectedPersonal ? selectedPersonal.email : "",
                mobileNo: selectedPersonal ? selectedPersonal.phoneNo : "",
              }}
              validationSchema={validationSchema}
              onSubmit={savePersonalData}
            >
              {({ values, handleChange, handleBlur, touched, errors }) => (
                <Form>
                  <Field
                    name="ownerName"
                    as={TextField}
                    label="Owner Name"
                    value={values.ownerName}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    fullWidth
                    margin="normal"
                    error={touched.ownerName && Boolean(errors.ownerName)}
                    helperText={touched.ownerName && errors.ownerName}
                  />
                  <Field
                    name="email"
                    as={TextField}
                    label="Email"
                    value={values.email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    fullWidth
                    margin="normal"
                    error={touched.email && Boolean(errors.email)}
                    helperText={touched.email && errors.email}
                  />
                  <Field
                    name="mobileNo"
                    as={TextField}
                    label="Mobile No"
                    value={values.mobileNo}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    fullWidth
                    margin="normal"
                    error={touched.mobileNo && Boolean(errors.mobileNo)}
                    helperText={touched.mobileNo && errors.mobileNo}
                  />

                  <DialogActions>
                    <Button onClick={handleCloseDialog} color="primary">
                      Cancel
                    </Button>
                    <Button type="submit" color="primary" disabled={loading}>
                      {loading ? "Saving..." : "Save"}
                    </Button>
                  </DialogActions>
                </Form>
              )}
            </Formik>
          </DialogContent>
        </Dialog>
      </Box>
    </Box>
  );
};

export default PersonalPage;
