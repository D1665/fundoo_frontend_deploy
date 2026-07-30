const isLocal = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.'));

export const environment = {
  production: false,
  apiUrl: isLocal ? 'http://localhost:8086/api' : 'https://fundoo-backend-o1h7.onrender.com/api'
};