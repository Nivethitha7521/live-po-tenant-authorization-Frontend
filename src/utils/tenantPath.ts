export const getTenantPath = (path: string) => {
  if (typeof window === "undefined") return path;

  const slug = localStorage.getItem("tenant_slug");

  if (!slug) return path;

  // Ensure path starts with /
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  return `/${slug}${cleanPath}`;
};