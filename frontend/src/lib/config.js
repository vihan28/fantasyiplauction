const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL;

function getDefaultApiBaseUrl() {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:5000";
  }

  return `${window.location.protocol}//${window.location.hostname}:5000`;
}

export const API_BASE_URL = configuredBaseUrl || getDefaultApiBaseUrl();
