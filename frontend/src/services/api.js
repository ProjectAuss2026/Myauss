const API_BASE_URL = '';

export async function fetchFromAPI(endpoint) {
  const response = await fetch(`${API_BASE_URL}/api${endpoint}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  return response.json();
}
