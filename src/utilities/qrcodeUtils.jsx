import QRCode from 'qrcode';

export const generateQRCodeData = async (text) => {
  try {
    const dataUrl = await QRCode.toDataURL(text);
    return dataUrl.split(',')[1]; // Extract base64 string
  } catch (error) {
    console.error('Failed to generate QR code:', error);
  }
};
