// import React from 'react';
// import { FormControl, InputLabel, Select, MenuItem, Checkbox, Box, ListItemText, TextField } from '@mui/material';
// import { DateRangePicker, TimePicker, DatePicker as MuiDatePicker } from '@mui/x-date-pickers-pro';
// import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
// import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
// import { Dayjs, RangeValue } from 'dayjs';

// interface MultiSelectProps {
//   label: string;
//   value: string[];
//   options: string[];
//   onChange: (value: string[]) => void;
// }

// export const MultiSelect: React.FC<MultiSelectProps> = ({ label, value, options, onChange }) => (
//   <FormControl fullWidth margin="normal">
//     <InputLabel>{label}</InputLabel>
//     <Select
//       multiple
//       value={value}
//       onChange={(e) => onChange(e.target.value as string[])}
//       renderValue={(selected) => (selected as string[]).join(', ')}
//     >
//       {options.map((option) => (
//         <MenuItem key={option} value={option}>
//           <Checkbox checked={value.indexOf(option) > -1} />
//           <ListItemText primary={option} />
//         </MenuItem>
//       ))}
//     </Select>
//   </FormControl>
// );

// interface DateRangePickerProps {
//   value: RangeValue<Dayjs>;
//   onChange: (value: RangeValue<Dayjs>) => void;
// }

// export const DateRangePickerField: React.FC<DateRangePickerProps> = ({ value, onChange }) => (
//   <LocalizationProvider dateAdapter={AdapterDayjs}>
//     <DateRangePicker
//       startText="From Date"
//       endText="To Date"
//       value={value}
//       onChange={onChange}
//       renderInput={(startProps, endProps) => (
//         <>
//           <TextField {...startProps} fullWidth margin="normal" />
//           <Box sx={{ mx: 2 }}> to </Box>
//           <TextField {...endProps} fullWidth margin="normal" />
//         </>
//       )}
//     />
//   </LocalizationProvider>
// );

// interface DatePickerProps {
//   value: Dayjs | null;
//   onChange: (value: Dayjs | null) => void;
// }

// export const DatePicker: React.FC<DatePickerProps> = ({ value, onChange }) => (
//   <LocalizationProvider dateAdapter={AdapterDayjs}>
//     <MuiDatePicker
//       label="Select Date"
//       value={value}
//       onChange={onChange}
//       renderInput={(params) => <TextField {...params} fullWidth margin="normal" />}
//     />
//   </LocalizationProvider>
// );

// interface TimePickerFieldProps {
//   label: string;
//   value: Dayjs | null;
//   onChange: (value: Dayjs | null) => void;
//   ampm?: boolean; // Optional prop to support 12-hour (default) or 24-hour format
// }

// export const TimePickerField: React.FC<TimePickerFieldProps> = ({ label, value, onChange, ampm = true }) => (
//   <LocalizationProvider dateAdapter={AdapterDayjs}>
//     <TimePicker
//       label={label}
//       value={value}
//       onChange={onChange}
//       ampm={ampm} // Use 12-hour or 24-hour format based on prop
//       minutesStep={5} // Adjust the minute step if needed
//       renderInput={(params) => <TextField {...params} fullWidth margin="normal" />}
//     />
//   </LocalizationProvider>
// );
