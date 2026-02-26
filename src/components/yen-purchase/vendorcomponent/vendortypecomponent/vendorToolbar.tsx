'use client';
import React from 'react';
import { Box, TextField, IconButton, Typography, Switch } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

interface VendorToolbarProps {
  searchQuery: string;
  showDeactivated: boolean;
  onSearch: (query: string) => void;
  onAdd: () => void;
  onToggleDeactivated: () => void;
  showAddButton: boolean;
}

const VendorToolbar: React.FC<VendorToolbarProps> = ({
  searchQuery,
  showDeactivated,
  onSearch,
  onAdd,
  onToggleDeactivated,
  showAddButton = true,
}) => {
  return (
    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
      {/* Search Field */}
      <TextField
        autoComplete="off"
        label="Search"
        variant="outlined"
        className="some"
        value={searchQuery}
        onChange={(e) => onSearch(e.target.value)}
        sx={{ flex: 1, ml: 2 }}
        size="small"
      />

      {/* Action Buttons */}
      <Box display="flex" alignItems="center" gap={1}>
        {showAddButton && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <IconButton
            color="primary"
            onClick={onAdd}
            className="icon-button-outline"
            size="small"
            sx={{ p: 0.2 }}
          >
            <AddIcon fontSize="small" />
          </IconButton>
          <Typography
            variant="caption"
            align="center"
            sx={{
              maxWidth: 30,
              wordBreak: 'break-word',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.1,
              mt: 0.1,
            }}
          >
            Add
          </Typography>
        </Box>
        )}
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
            onChange={onToggleDeactivated}
            size="small"
            sx={{ height: 24 }}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default VendorToolbar;