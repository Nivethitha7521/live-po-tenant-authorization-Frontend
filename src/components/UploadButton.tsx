import React, { ChangeEvent } from 'react';
import { Button } from '@mui/material';

interface UploadButtonProps {
  onUpload: (files: FileList | null) => void; // Changed to accept FileList for multiple files
}

const UploadButton: React.FC<UploadButtonProps> = ({ onUpload }) => {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files; // Get the FileList
    onUpload(files); // Pass the FileList to the parent
    event.target.value = ''; // Reset the input value for subsequent uploads
  };

  return (
    <Button variant="contained" component="label">
      Upload Files
      <input
        type="file"
        hidden
        onChange={handleFileChange}
        multiple // Allow multiple file selection
        accept="application/pdf,image/*" // Specify accepted file types
      />
    </Button>
  );
};

export default UploadButton;
