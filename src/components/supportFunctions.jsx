// src/supportFunctions.jsx

/**
 * Searches for sources by an exact name via API call.
 * @param {string} sourceName The exact source name to query.
 * @returns {Promise<Array|null>} A promise that resolves to an array of matching sources, 
 * or null if a network/API error occurs. Returns an empty array for no matches.
 */
export async function findSourceByName(sourceName) {
  const trimmedName = sourceName.trim();
  if (!trimmedName) {
    return []; // No need to search if the name is empty.
  }

  // Get API configuration from environment variables
  const API_URL = import.meta.env.VITE_API_URL;
  const API_KEY = import.meta.env.VITE_API_KEY;

  if (!API_URL || !API_KEY) {
    console.error("API URL or API Key is not configured.");
    throw new Error("API configuration is missing.");
  }

  const authToken = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    "x-api-key": API_KEY,
    ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {}),
  };

  // Construct the URL for an exact match query on 'source_name'
  const endpoint = `${String(API_URL).replace(/\/+$/, "")}/sources`;
  const url = new URL(endpoint);
  url.searchParams.append("source_name", trimmedName);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: headers,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`API request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Failed to fetch source:", error);
    return null; // Return null to indicate a fetch error occurred
  }
}

export async function getDirtyWords() {
  const API_URL = import.meta.env.VITE_API_URL;
  const API_KEY = import.meta.env.VITE_API_KEY;

  if (!API_URL || !API_KEY) {
    console.error("API URL or API Key is not configured.");
    return [];
  }

  const headers = {
    "Content-Type": "application/json",
    "x-api-key": API_KEY,
    // No auth token needed based on API docs for this endpoint
  };

  const endpoint = `${String(API_URL).replace(/\/+$/, "")}/dirty_words`;

  try {
    const response = await fetch(endpoint, { method: "GET", headers: headers });
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Failed to fetch dirty words:", error);
    return []; // Return empty array on error to prevent crashes
  }
}