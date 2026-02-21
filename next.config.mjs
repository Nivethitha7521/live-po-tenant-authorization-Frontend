/** @type {import('next').NextConfig} */
const nextConfig = {
  //output: 'export', // Generates a static export of the site
  trailingSlash: true ,// Adds a trailing slash to all URLs
  reactStrictMode: true,
  images: {
    unoptimized: true
  },
};

export default nextConfig; 
