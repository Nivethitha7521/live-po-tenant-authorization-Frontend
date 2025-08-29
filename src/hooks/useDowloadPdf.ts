import axios from 'axios';
import { saveAs } from 'file-saver';

export const useDownloadPdf = () => {
  const downloadPdf = async (url: string, filename: string) => {
    try {
      const response = await axios.get(url, {
        responseType: 'blob',
      });
      
      const pdfBlob = new Blob([response.data], { type: 'application/pdf' });
      saveAs(pdfBlob, filename);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      throw error;
    }
  };

  return { downloadPdf };
};