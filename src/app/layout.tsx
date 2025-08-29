// src/app/layout.tsx
"use client";

import { Provider } from 'react-redux';
import store from '../redux/store';
import ClientLayout from './ClientLayout';
import '../app/globals.css';
import { ToastContainer } from 'react-toastify';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* <link
          href="https://fonts.googleapis.com/css2?family=ABeeZee&display=swap"
          rel="stylesheet"
        /> */}
        <link
          href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&display=swap"
          rel="stylesheet"
        />

        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css" />
      </head>
      <body>
        <Provider store={store}>
          <ClientLayout>{children}</ClientLayout>
          <ToastContainer position="top-right" autoClose={1000} hideProgressBar={false} />
        </Provider>
      </body>
    </html>
  );
}
