export const connectToBluetoothPrinter = async () => {
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['battery_service'] }],
      });
  
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService('battery_service');
      const characteristic = await service.getCharacteristic('battery_level');
  
      return characteristic;
    } catch (error) {
      console.error('Failed to connect to Bluetooth printer:', error);
      return null;
    }
  };
  
  export const sendToBluetoothPrinter = async (characteristic, data) => {
    try {
      const encoder = new TextEncoder();
      const encodedData = encoder.encode(data);
      await characteristic.writeValue(encodedData);
      console.log('Data sent to Bluetooth printer');
    } catch (error) {
      console.error('Failed to send data to Bluetooth printer:', error);
    }
  };
  