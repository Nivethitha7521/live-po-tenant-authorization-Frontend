import { TextField } from '@mui/material';
import { Field } from 'formik';
import { RefObject } from 'react';

interface OptimizedTextFieldProps {
  label: string;
  name: string;
  type: string;
  autoComplete?: string;
  required?: boolean;
  multiline?: boolean;
  inputRef?: RefObject<HTMLInputElement>; // Add inputRef prop
}

const OptimizedTextField: React.FC<OptimizedTextFieldProps> = ({
  label,
  name,
  type,
  autoComplete,
  required,
  multiline,
  inputRef,
}) => (
  <Field name={name}>
    {({ field, form }: { field: any; form: any }) => (
      <TextField
        {...field}
        inputRef={inputRef} // Pass inputRef to TextField
        label={label}
        type={type}
        autoComplete={autoComplete}
        required={required}
        multiline={multiline}
        variant="outlined"
        fullWidth
        value={field.value ?? (type === 'number' ? 0 : '')} // Ensure no null, handle number type
        error={form.touched[name] && Boolean(form.errors[name])}
        helperText={form.touched[name] && form.errors[name]}
        InputLabelProps={{
          sx: {
            // Apply red asterisk for required fields
            ...(required && {
              '&::after': {
                content: '"*"',
                color: 'red',
                marginLeft: '4px',
              },
            }),
            '&.Mui-focused': {
              color: undefined, // Use default focused color
            },
            '&.Mui-error': {
              color: 'error.main', // Error color for validation errors
            },
          },
        }}
      />
    )}
  </Field>
);

export default OptimizedTextField;