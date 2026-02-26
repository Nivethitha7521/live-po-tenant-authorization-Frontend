import React from 'react';
import QRCode from 'qrcode.react';

interface QRCodeLabelProps {
  text: string;
  itemName: string;
  price: string;
  expDate: string;
  mfgDate: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
  includeMargin?: boolean;
}

const QRCodeLabel: React.FC<QRCodeLabelProps> = ({ text, itemName, price, expDate, mfgDate, size = 45, level = 'L', includeMargin = false }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '40mm', height: '30mm', boxSizing: 'border-box', padding: '1mm' }}>
      <div style={{ textAlign: 'left', fontSize: '10px', lineHeight: '1.1', paddingLeft: '2mm' }}>
        <div>{itemName}</div>
        <div>{`Price: ${price}`}</div>
        <div>{`Exp: ${expDate}`}</div>
        <div>{`Mfg: ${mfgDate}`}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: 'auto' }}>
        <QRCode
          value={text}
          size={size}
          level={level}
          includeMargin={includeMargin}
        />
      </div>
    </div>
  );
};

export default QRCodeLabel;
