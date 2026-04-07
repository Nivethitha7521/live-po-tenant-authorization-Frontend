// utilities/tscPrinterUtils.js

export const sendToTSCNetworkPrinter = async (command) => {
    try {
      const response = await fetch('http://192.168.1.49', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: new TextEncoder().encode(command),
      });
  
      if (response.ok) {
        console.log('Print successful');
      } else {
        console.error('Print failed', response.statusText);
      }
    } catch (error) {
      console.error('Error sending to printer', error);
    }
  };
  