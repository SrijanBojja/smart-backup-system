import axios from 'axios';

const API = axios.create({
  baseURL: 'https://smart-backup-system-cxqg.onrender.com'
});

export default API;