import { useState, useEffect, useMemo } from 'react';

export function usePlatforms() {
  const [platformOptions, setPlatformOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const BASE = useMemo(() => (import.meta.env.VITE_API_URL || "").replace(/\/+$/, ""), []);
  const API_KEY = import.meta.env.VITE_API_KEY;

  useEffect(() => {
    let isMounted = true;

    const fetchPlatforms = async () => {
      try {
        const res = await fetch(`${BASE}/platforms`, {
          method: "GET",
          headers: { 
            "Content-Type": "application/json", 
            "x-api-key": API_KEY 
          },
        });

        if (!res.ok) throw new Error("Failed to fetch platforms");

        const data = await res.json();
        
        if (isMounted) {
          // Sort by ID as requested
          const sorted = [...data].sort((a, b) => a.id - b.id);
          // Extract just the names to match your current array format
          setPlatformOptions(sorted.map(p => p.platform_name));
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    fetchPlatforms();
    return () => { isMounted = false; };
  }, [BASE, API_KEY]);

  return { platformOptions, loading, error };
}