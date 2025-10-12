import * as fabric from 'fabric';

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

    const result = await response.json();
    return Array.isArray(result.data) ? result.data : [];
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

/**
 * Checks for the exact phrase "(USPER)" in a given string.
 * @param {string} text The text to search within.
 * @returns {boolean} True if the exact phrase is found, otherwise false.
 */
export function usperCheck(text) {
  if (typeof text !== 'string') {
    return false;
  }
  return text.includes("(USPER)");
}

/**
 * Adds a classification banner to an image using Fabric.js.
 * @param {File} imageFile The original image file to modify.
 * @param {'U' | 'CUI' | 'CUIREL'} classification The classification level.
 * @returns {Promise<File>} A promise that resolves to a new File object with the banner baked in.
 */
// In supportFunctions.jsx

export async function classifyImage(imageFile, classification) {
  return new Promise((resolve, reject) => {
    const fabricLib = fabric.default || fabric;
    const reader = new FileReader();

    reader.onload = (event) => {
      const imageUrl = event.target.result;
      const htmlImageElement = new window.Image();
      htmlImageElement.crossOrigin = "anonymous";

      htmlImageElement.onload = () => {
        try {
          const fabricImage = new fabricLib.Image(htmlImageElement);
          const canvas = new fabricLib.StaticCanvas(null, {
            width: fabricImage.width,
            height: fabricImage.height,
          });

          canvas.add(fabricImage);

          let bannerConfig;
          // --- [MODIFIED] Add a 'width' property for each case ---
          switch (classification) {
            case 'CUI':
              bannerConfig = { text: 'CUI', bgColor: '#581c87', width: 60 };
              break;
            case 'CUIREL':
              bannerConfig = { text: 'CUI//REL TO USA, FVEY', bgColor: '#581c87', width: 150 };
              break;
            default:
              bannerConfig = { text: 'U', bgColor: '#16a34a', width: 40 };
              break;
          }

          const PADDING = 8;
          const FONT_SIZE = 12;

          // --- Create Top-Right Banner ---
          const textTopRight = new fabricLib.Textbox(bannerConfig.text, {
            fontFamily: 'Arial',
            fontSize: FONT_SIZE,
            fontWeight: 'bold',
            fill: 'white',
            textAlign: 'center',
            width: bannerConfig.width, // [MODIFIED] Use the width from the config
            originX: 'center',
            originY: 'center',
          });

          const rectTopRight = new fabricLib.Rect({
            width: textTopRight.width + PADDING * 2,
            height: textTopRight.height + PADDING * 2,
            fill: bannerConfig.bgColor,
            stroke: 'black',
            strokeWidth: 1.5,
            originX: 'center',
            originY: 'center',
          });

          const bannerTopRight = new fabricLib.Group([rectTopRight, textTopRight], {
            originX: 'right',
            originY: 'top',
            left: fabricImage.width - PADDING,
            top: PADDING,
          });

          // --- Create Bottom-Left Banner ---
          const textBottomLeft = new fabricLib.Textbox(bannerConfig.text, {
            fontFamily: 'Arial',
            fontSize: FONT_SIZE,
            fontWeight: 'bold',
            fill: 'white',
            textAlign: 'center',
            width: bannerConfig.width, // [MODIFIED] Use the width from the config
            originX: 'center',
            originY: 'center',
          });

          const rectBottomLeft = new fabricLib.Rect({
            width: textBottomLeft.width + PADDING * 2,
            height: textBottomLeft.height + PADDING * 2,
            fill: bannerConfig.bgColor,
            stroke: 'black',
            strokeWidth: 1.5,
            originX: 'center',
            originY: 'center',
          });

          const bannerBottomLeft = new fabricLib.Group([rectBottomLeft, textBottomLeft], {
            originX: 'left',
            originY: 'bottom',
            left: PADDING,
            top: fabricImage.height - PADDING,
          });
          
          canvas.add(bannerTopRight, bannerBottomLeft);
          canvas.renderAll();

          canvas.getElement().toBlob(
            (blob) => {
              if (!blob) {
                return reject(new Error('Canvas to Blob conversion failed.'));
              }
              const newFile = new File([blob], imageFile.name, {
                type: blob.type,
                lastModified: Date.now(),
              });
              resolve(newFile);
            },
            imageFile.type === 'image/jpeg' ? 'image/jpeg' : 'image/png'
          );
        } catch (err) {
            console.error("Error during Fabric.js canvas processing:", err);
            reject(err);
        }
      };

      htmlImageElement.onerror = () => {
        console.error("Browser failed to load image from Data URL.");
        reject(new Error("The browser could not load the image."));
      };

      htmlImageElement.src = imageUrl;
    };

    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(imageFile);
  });
}