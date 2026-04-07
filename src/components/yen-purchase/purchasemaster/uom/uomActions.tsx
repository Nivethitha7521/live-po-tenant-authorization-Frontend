'use client';
import React, { useRef } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Tooltip,
  FormControlLabel,
  Switch,
  Backdrop,
  CircularProgress,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  InsertDriveFile as InsertDriveFileIcon,
  GetApp as GetAppIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';

interface UOMActionsProps {
  searchQuery: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
   onDialogOpen: (action?: 'add' | 'edit') => void; // ✅ UPDATE TYPE
  showDeactivated: boolean;
  onToggleShowDeactivated: () => void;
   permissions?: { // ✅ ADD PERMISSIONS PROP
    add?: boolean;
    edit?: boolean;
    delete?: boolean;
  };
}

const UOMActions: React.FC<UOMActionsProps> = ({
  searchQuery,
  onSearchChange,
  onDialogOpen,
  showDeactivated,
  onToggleShowDeactivated,
  permissions = { add: true, edit: true, delete: true } // ✅ DEFAULT PERMISSIONS
}) => {
  
const { add = true } = permissions; // ✅ DESTRUCTURE PERMISSIONS
  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1} >
        <TextField
          autoComplete="off"
          label="Search"
          variant="outlined"
          value={searchQuery}
          className='some'
          onChange={onSearchChange}
          sx={{ flex: 1 }}
        />

        <Box display="flex" alignItems="center" gap={1} >
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
           <IconButton
  color="primary"
  onClick={() => onDialogOpen('add')} // ✅ CORRECT - function reference
  className="icon-button-outline"
  size='small'
  sx={{ p: 0.3,
    opacity: add ? 1 : 0.5,
    '&.Mui-disabled': {
      opacity: 0.5,
      borderColor: 'grey.400 !important',
      color: 'grey.500 !important'
    } }}
  disabled={!add}
>
  <AddIcon />
</IconButton>
            <Typography
              variant="caption"
              align="center"
              sx={{
                maxWidth: 40,
                wordBreak: 'break-word',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.1,
                mt: 0.2,
                color: add ? 'text.primary' : 'grey.500', // ✅ ADD COLOR CHANGE
              }}
            >
              Add
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography
              variant="caption"
              align="center"
              sx={{
                maxWidth: 60,
                wordBreak: 'break-word',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.1,
                mt: 0.2,
              }}
            >
              {showDeactivated ? 'Deactivated' : 'Activated'}
            </Typography>
            <Switch
              checked={showDeactivated}
              onChange={onToggleShowDeactivated}
              name="showDeactivated"
              size="small"
              sx={{ height: 24 }}
            />
          </Box>
        </Box>
      </Box>
    </Box>

  );
};

export default UOMActions;