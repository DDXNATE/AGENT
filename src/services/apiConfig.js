const isDevelopment = import.meta.env.DEV;

export const API_BASE_URL = isDevelopment 
  ? '/api' 
  : '/api';

export const getApiUrl = (endpoint) => {
  return `${API_BASE_URL}/${endpoint}`;
};
