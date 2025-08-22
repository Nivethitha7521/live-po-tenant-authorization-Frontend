import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { TextField, Grid, MenuItem } from '@mui/material';
import {
  fetchCountries,
  fetchStates,
  fetchCities,
  setSelectedCountry,
  setSelectedState,
  setSelectedCity,
  setPostalCode,
  initializeLocationFromForm
} from '../features/locationAreaSlice';
import { RootState, AppDispatch } from '../redux/store';
import { FormikProps } from 'formik';

interface LocationAreaProps {
  formik: FormikProps<any>;
}

const LocationArea: React.FC<LocationAreaProps> = ({ formik }) => {
  const dispatch = useDispatch<AppDispatch>();
  const {
    countries,
    states,
    cities,
    selectedCountry,
    selectedState,
    selectedCity,
    postalCode,
  } = useSelector((state: RootState) => state.locationAreas);
  
  // Track initialization state
  const [isInitialized, setIsInitialized] = useState(false);
  // const prevVendorId = React.useRef(formik.values.vendorId);

  // useEffect(() => {
  //   // Reset initialization state when formik values change significantly
  //   // This helps when opening a new dialog after editing
  //   if (formik.values.vendorId !== prevVendorId.current) {
  //     setIsInitialized(false);
  //     prevVendorId.current = formik.values.vendorId;
  //   }
  // }, [formik.values.vendorId]);
  
  // Load countries on component mount
  useEffect(() => {
    dispatch(fetchCountries());
  }, [dispatch]);
  // Initialize location data from formik values when editing
  useEffect(() => {
    const initializeLocationData = async () => {
      // Only run initialization once and when we have formik values and countries
      if (!isInitialized && formik.values && countries.length > 0) {
        const { country, state, city, postalCode: formPostalCode } = formik.values;
        
        // If we have country data from the form, initialize the location state
        if (country) {
          const countryObj = countries.find(c => c.label === country);
          
          if (countryObj) {
            // Fetch states for this country
            await dispatch(fetchStates(countryObj.value));
            
            let stateObj = null;
            let cityObj = null;
            
            // If we have state data, find the state object
            if (state) {
              const statesResult = await dispatch(fetchStates(countryObj.value));
              const statesData = statesResult.payload as { value: string; label: string }[];
              
              stateObj = statesData.find(s => s.label === state);
              
              // If we have state and city data, find the city object
              if (stateObj && city) {
                const citiesResult = await dispatch(fetchCities({
                  countryIsoCode: countryObj.value,
                  stateIsoCode: stateObj.value
                }));
                const citiesData = citiesResult.payload as { value: string; label: string }[];
                
                cityObj = citiesData.find(c => c.label === city);
              }
            }
            
            // Initialize the location state with the form data
            dispatch(initializeLocationFromForm({
              countryObj, 
              stateObj, 
              cityObj,
              postalCode: formPostalCode
            }));
            
            setIsInitialized(true);
          }
        }
      }
    };

    initializeLocationData();
  }, [formik.values, countries, dispatch, isInitialized]);

  const handleCountryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = countries.find(country => country.value === event.target.value);
    if (newValue) {
      dispatch(setSelectedCountry(newValue));
      dispatch(fetchStates(newValue.value));
      formik.setFieldValue('country', newValue.label);
      formik.setFieldValue('state', '');
      formik.setFieldValue('city', '');
      formik.setFieldValue('postalCode', '');
    } else {
      dispatch(setSelectedCountry(null));
      formik.setFieldValue('country', '');
    }
  };

  const handleStateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = states.find(state => state.value === event.target.value);
    if (newValue) {
      dispatch(setSelectedState(newValue));
      if (selectedCountry) {
        dispatch(fetchCities({ countryIsoCode: selectedCountry.value, stateIsoCode: newValue.value }));
      }
      formik.setFieldValue('state', newValue.label);
      formik.setFieldValue('city', '');
      formik.setFieldValue('postalCode', '');
    } else {
      dispatch(setSelectedState(null));
      formik.setFieldValue('state', '');
    }
  };

  const handleCityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = cities.find(city => city.value === event.target.value);
    if (newValue) {
      dispatch(setSelectedCity(newValue));
      formik.setFieldValue('city', newValue.label);
    } else {
      dispatch(setSelectedCity(null));
      formik.setFieldValue('city', '');
    }
  };

  const handlePostalCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    dispatch(setPostalCode(value));
    formik.setFieldValue('postalCode', value);
  };

  return (
    <Grid container spacing={2} mt={1} ml={0.2}>
      {/* Country - 3 columns */}
      <Grid item xs={12} sm={6} md={3}>
        <TextField
          select
          fullWidth
          label="Select Country"
          value={selectedCountry?.value || ''}
          onChange={handleCountryChange}
          variant="outlined"
        >
          {countries.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      </Grid>

      {/* State - 3 columns */}
      <Grid item xs={12} sm={6} md={3}>
        <TextField
          select
          fullWidth
          label="Select State"
          value={selectedState?.value || ''}
          onChange={handleStateChange}
          variant="outlined"
          disabled={!selectedCountry}
        >
          {states.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      </Grid>

      {/* City - 3 columns */}
      <Grid item xs={12} sm={6} md={3}>
        <TextField
          select
          fullWidth
          label="Select City"
          value={selectedCity?.value || ''}
          onChange={handleCityChange}
          variant="outlined"
          disabled={!selectedState}
        >
          {cities.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      </Grid>

      {/* Postal Code - 3 columns */}
      <Grid item xs={12} sm={6} md={3}>
        <TextField
          fullWidth
          label="Postal Code"
          value={formik.values.postalCode || ''}
          onChange={handlePostalCodeChange}
          variant="outlined"
          disabled={!selectedCity}
        />
      </Grid>
    </Grid>
  );
};

export default LocationArea;