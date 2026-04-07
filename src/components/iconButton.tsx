import { styled } from '@mui/system';
import IconButton, { IconButtonProps } from '@mui/material/IconButton'; // Import IconButtonProps
import AddIcon from '@mui/icons-material/Add';
import UploadIcon from '@mui/icons-material/Upload';
import GetAppIcon from '@mui/icons-material/GetApp';

// Extend IconButtonProps to allow the component prop
interface CustomIconButtonProps extends IconButtonProps {
  component?: React.ElementType; // Add component prop to allow it to work as a label
}

export const CustomIconButton = styled(IconButton)<CustomIconButtonProps>(({ theme }) => ({
  borderRadius: '50%',
  border: '1px solid', // Outlined border
  borderColor: theme.palette.primary.main, // Blue border color
  '&:hover': {
    backgroundColor: theme.palette.primary.main, // Blue background on hover
    color: 'white', // White icon color on hover
  },
}));
