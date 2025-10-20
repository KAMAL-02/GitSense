const axios = require('axios');
import { globalConfig } from "../extension";
import { getGithubService } from "../extension";

const api = axios.create({
  timeout: 8000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config: any) => {

  config.baseURL = globalConfig.apiUrl;
  
  // Add GitHub token
  const githubService = getGithubService();
  const token = githubService?.Info?.token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  console.log("Making request to:", config.baseURL + config.url);
  return config;
});

api.interceptors.response.use(
  (response: any) => {
    return response;
  },
  async (error: any) => {
    const { response } = error;
    if (response && response.status !== 200) {
      const errorMessage = await response.data;
      console.error("API Error:", errorMessage);
    }
    return Promise.reject(error);
  }
);

export default api;