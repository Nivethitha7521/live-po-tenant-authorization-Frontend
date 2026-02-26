import * as Yup from 'yup';

export const validationSchema = Yup.object().shape({
  name: Yup.string()
    .matches(/^[a-zA-Z\s]+$/, "Name should only contain alphabets")
    .required('Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be at most 50 characters'),

  phone: Yup.string()
    .matches(/^[0-9]+$/, "Phone number should only contain numbers")
    .required('Phone number is required')
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number must be at most 15 digits'),

  value: Yup.number()
    .typeError('Value must be a number')
    .required('Value is required')
    .min(0, 'Value must be greater than or equal to 0')
    .max(10000, 'Value must be less than or equal to 10000'),

  percentage: Yup.number()
    .typeError('Percentage must be a number')
    .max(100, 'Percentage cannot be more than 100')
    .required('Percentage is required'),

  email: Yup.string()
    .email('Invalid email format')
    .required('Email is required'),

  url: Yup.string()
    .url('Invalid URL format')
    .required('URL is required'),

  date: Yup.date()
    .typeError('Invalid date format')
    .required('Date is required'),

  arrayField: Yup.array()
    .of(
      Yup.string().required('Array elements must be strings')
    )
    .min(1, 'Array must have at least one element')
    .max(10, 'Array must have at most ten elements'),

  objectField: Yup.object().shape({
    subField1: Yup.string().required('SubField1 is required'),
    subField2: Yup.number().required('SubField2 is required')
  }),

  enumField: Yup.string()
    .oneOf(['Option1', 'Option2', 'Option3'], 'Invalid option selected')
    .required('EnumField is required'),

  anotherField: Yup.string().required('AnotherField is required'),

  conditionalField: Yup.string().when('anotherField', {
    is: (value: string) => value === 'someValue',
    then: schema => schema.required('ConditionalField is required when anotherField is someValue'),
    otherwise: schema => schema
  }),

  country: Yup.string().required('Country is required'),
  state: Yup.string().required('State is required'),
  city: Yup.string().required('City is required'),
  postalCode: Yup.string()
    .required('Postal Code is required')
    .matches(/^[0-9]+$/, "Postal Code should only contain numbers")
    .min(4, 'Postal Code must be at least 4 digits')
    .max(10, 'Postal Code must be at most 10 digits'),

  gst: Yup.string()
    .matches(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}[Z]{1}[A-Z\d]{1}$/, "Invalid GST number format")
    .required('GST number is required')
});
