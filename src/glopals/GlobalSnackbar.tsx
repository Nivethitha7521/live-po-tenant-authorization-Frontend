import React from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Slide, { SlideProps } from '@mui/material/Slide';

interface GlobalSnackbarProps {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
}

// Slide transition from the right
const SlideTransition = (props: SlideProps) => {
  return <Slide {...props} direction="right" />; // comes in from the right
};

const GlobalSnackbar: React.FC<GlobalSnackbarProps> = ({ open, message, severity, onClose }) => {
  return (
    <Snackbar
      open={open}
      autoHideDuration={4000}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      TransitionComponent={SlideTransition}
      sx={{ mb: 2, mr: 2, zIndex: 9999 }} 
    >
      <Alert
        onClose={onClose}
        severity={severity}
        variant="filled"
        sx={{
          width: '100%',
          backgroundColor: 'black',
          color: 'white',
          boxShadow: '0px 4px 10px rgba(0,0,0,0.3)',
          '& .MuiAlert-icon': { color: 'white' },
        }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
};

export default GlobalSnackbar;
