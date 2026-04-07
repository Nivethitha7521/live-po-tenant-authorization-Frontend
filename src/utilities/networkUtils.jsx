import escpos from 'escpos';
import { Network } from 'escpos-network';

// Enable promisify for escpos
escpos.Network = Network;

export const connectToNetworkPrinter = async (ipAddress) => {
  try {
    const device = new escpos.Network(ipAddress);
    const options = { encoding: "GB18030" }; // Set encoding if needed
    const printer = new escpos.Printer(device, options);

    await new Promise((resolve, reject) => {
      device.open((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

    return printer;
  } catch (error) {
    console.error('Failed to connect to network printer:', error);
    return null;
  }
};

export const sendToNetworkPrinter = async (printer, data) => {
  try {
    printer
      .text(data)
      .cut()
      .close();
    console.log('Data sent to network printer');
  } catch (error) {
    console.error('Failed to send data to network printer:', error);
  }
};
