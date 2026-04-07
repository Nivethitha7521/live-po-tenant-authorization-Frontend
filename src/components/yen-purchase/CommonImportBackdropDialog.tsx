'use client';
import { Backdrop, Box, CircularProgress, Typography } from '@mui/material';

interface CommonImportBackdropProps {
  open: boolean;
}

const CommonImportBackdrop: React.FC<CommonImportBackdropProps> = ({ open }) => {
  return (
    <Backdrop
      sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.modal + 1 }}
      open={open}
    >
      <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
        <CircularProgress color="inherit" />
        <Typography>Import is in progress, please wait...</Typography>
      </Box>
    </Backdrop>
  );
};

export default CommonImportBackdrop;

