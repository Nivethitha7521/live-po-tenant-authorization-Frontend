import React, { useState } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import Image from 'next/image';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import EditIcon from '@mui/icons-material/Edit';

interface PhotoDisplayProps {
  orderId: string;
  imageUrls: string[]; // Array with 0-based index
  onImageClick?: (url: string, displayIndex: number) => void;
  onUploadClick: (orderId: string, backendIndex: number) => void;
}

const PhotoDisplay: React.FC<PhotoDisplayProps> = ({
  orderId,
  imageUrls,
  onImageClick,
  onUploadClick
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [previewPosition, setPreviewPosition] = useState({ top: 0, left: 0 });

  // Ensure we always have exactly 3 slots (filled or empty)
  const displayUrls = Array(3).fill('').map((_, index) => imageUrls[index] || '');

  const handleMouseEnter = (index: number, event: React.MouseEvent) => {
    if (!displayUrls[index]) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    setPreviewPosition({
      top: rect.top - 210, // Position above the thumbnail (200px height + 10px gap)
      left: rect.left - 50  // Align with left edge of thumbnail
    });
    setHoveredIndex(index);
  };

  return (
    <>
      <Box display="flex" gap={1} position="relative">
        {displayUrls.map((url, zeroBasedIndex) => {
          const displayIndex = zeroBasedIndex + 1;
          
          return (
            <Box 
              key={`photo-${orderId}-${zeroBasedIndex}`}
              sx={{ 
                position: 'relative', 
                width: 50, 
                height: 50,
                border: '1px dashed #ccc',
                borderRadius: 1,
                overflow: 'hidden',
                '&:hover': { borderColor: 'primary.main' }
              }}
              onMouseEnter={(e) => handleMouseEnter(zeroBasedIndex, e)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {url ? (
                <>
                  <Image
                    src={`${url}?t=${Date.now()}`}
                    alt={`Receipt ${displayIndex}`}
                    width={50}
                    height={50}
                    style={{ 
                      cursor: 'pointer', 
                      objectFit: 'cover',
                      borderRadius: 4
                    }}
                  />
                  <IconButton
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      backgroundColor: 'rgba(255,255,255,0.7)',
                      '&:hover': { backgroundColor: 'rgba(255,255,255,0.9)' },
                      padding: '2px'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onUploadClick(orderId, displayIndex);
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </>
              ) : (
                <IconButton 
                  color="primary" 
                  sx={{ 
                    width: '100%', 
                    height: '100%',
                    flexDirection: 'column'
                  }}
                  onClick={() => onUploadClick(orderId, displayIndex)}
                >
                  <PhotoCamera fontSize="small" />
                  <Typography variant="caption">{displayIndex}</Typography>
                </IconButton>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Hover preview positioned near the thumbnail */}
      {hoveredIndex !== null && displayUrls[hoveredIndex] && (
        <Box
          sx={{
            position: 'fixed',
            top: `${previewPosition.top}px`,
            left: `${previewPosition.left}px`,
            width: 200,
            height: 200,
            border: '1px solid #ddd',
            borderRadius: 1,
            overflow: 'hidden',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            backgroundColor: 'white',
            zIndex: 1000,
            pointerEvents: 'none'
          }}
        >
          <Image
            src={`${displayUrls[hoveredIndex]}?t=${Date.now()}`}
            alt={`Receipt preview`}
            width={200}
            height={200}
            style={{
              objectFit: 'contain',
              width: '100%',
              height: '100%'
            }}
          />
        </Box>
      )}
    </>
  );
};

export default PhotoDisplay;