'use client';

import React, { useState } from 'react';
import { Box, Typography, Chip, TextField, InputAdornment, Stack, Tooltip, LinearProgress } from '@mui/material';
import { Search, CheckCircle, AddCircleOutline, InfoOutlined } from '@mui/icons-material';
import { ReportConfig } from '../engine/types';

interface GenericColumnFilterPanelProps {
  config: ReportConfig<any>;
  visibleColumns: string[];
  onToggleColumn: (key: string) => void;
}

export const GenericColumnFilterPanel: React.FC<GenericColumnFilterPanelProps> = ({
  config,
  visibleColumns,
  onToggleColumn,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const MAX_LIMIT = 12;
  const count = visibleColumns.length;
  const isFull = count >= MAX_LIMIT;

  // Filter columns based on search
  const displayColumns = config.columns.filter(col =>
    col.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggle = (key: string) => {
    // Simply toggle the column without checking any limits
    onToggleColumn(key);
  };

  return (
    <Box sx={{
      p: 2.5,
      mb: 4,
      borderRadius: '16px',
      border: '1px solid',
      borderColor: 'divider',
      bgcolor: 'background.paper',
      boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
    }}>
      {/* Smart Header Section */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" mb={3}>
        <TextField
          placeholder="Search columns..."
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ flexGrow: 1, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 20 }} /></InputAdornment>,
          }}
        />

        <Box sx={{ minWidth: 200 }}>
          <Stack direction="row" justifyContent="space-between" mb={0.5}>
            <Typography variant="caption" fontWeight="bold" color={isFull ? "error" : "primary"}>
              {count} / {MAX_LIMIT} Columns Active
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={(count / MAX_LIMIT) * 100}
            color={isFull ? "error" : "primary"}
            sx={{ height: 6, borderRadius: 5, bgcolor: 'grey.100' }}
          />
        </Box>
      </Stack>

      {/* Advanced Selection Grid */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        {displayColumns.map((col) => {
          const active = visibleColumns.includes(col.displayKey);
          const cannotSelect = !active && isFull;

          return (
            <Tooltip
              key={col.displayKey}
              title={cannotSelect ? "Deselect another column first to add this one" : ""}
              arrow
            >
              <Chip
                label={col.label}
                onClick={() => handleToggle(col.displayKey)}
                variant={active ? "filled" : "outlined"}
                color={active ? "primary" : "default"}
                icon={active ? <CheckCircle sx={{ fontSize: 18 }} /> : <AddCircleOutline sx={{ fontSize: 18 }} />}
                sx={{
                  borderRadius: '10px',
                  fontWeight: active ? 600 : 400,
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  // Visual lockout without disabling the button
                  opacity: cannotSelect ? 0.5 : 1,
                  filter: cannotSelect ? 'grayscale(1)' : 'none',
                  borderColor: active ? 'primary.main' : 'divider',
                  '&:hover': {
                    transform: cannotSelect ? 'none' : 'translateY(-2px)',
                    boxShadow: cannotSelect ? 'none' : '0 4px 8px rgba(0,0,0,0.1)',
                  }
                }}
              />
            </Tooltip>
          );
        })}
      </Box>

      {isFull && (
        <Stack direction="row" spacing={1} alignItems="center" mt={3} sx={{ color: 'text.secondary' }}>
          <InfoOutlined sx={{ fontSize: 16 }} />
          <Typography variant="caption">
            The PDF export is optimized for 12 columns.
          </Typography>
        </Stack>
      )}
    </Box>
  );
};

export default GenericColumnFilterPanel;