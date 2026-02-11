const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export async function fetchFromAPI(endpoint) {
  const response = await fetch(`${API_BASE_URL}/api${endpoint}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  return response.json();
}
