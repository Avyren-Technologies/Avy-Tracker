import express, { Response } from "express";
import { CustomRequest } from "../types";

const router = express.Router();

// Google Places API proxy endpoints with OpenStreetMap fallback
router.get("/autocomplete", async (req: CustomRequest, res: Response) => {
  try {
    const { input, types = "establishment|geocode" } = req.query;
    
    if (!input || typeof input !== 'string') {
      return res.status(400).json({ error: "Input parameter is required" });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const useGooglePlaces = process.env.USE_GOOGLE_PLACES !== 'false'; // Default to true
    
    // Try Google Places API first if key is available and enabled
    if (apiKey && useGooglePlaces) {
      try {
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${apiKey}&types=${types}`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
          return res.json(data);
        } else if (data.status === 'REQUEST_DENIED') {
          console.warn('Google Places API billing not enabled, falling back to OpenStreetMap');
          // Fall through to OpenStreetMap fallback
        } else {
          console.error('Google Places API error:', data);
          // Fall through to OpenStreetMap fallback
        }
      } catch (error) {
        console.error('Google Places API request failed:', error);
        // Fall through to OpenStreetMap fallback
      }
    }

    // OpenStreetMap Nominatim fallback
    console.log('Using OpenStreetMap Nominatim for place search');
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(input)}&limit=10&addressdetails=1&extratags=1`;
    
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'AvyTracker/1.0'
      }
    });
    
    const nominatimData = await response.json();
    
    // Convert Nominatim format to Google Places format
    const predictions = nominatimData.map((place: any, index: number) => ({
      place_id: `osm_${place.place_id || index}`,
      description: place.display_name,
      structured_formatting: {
        main_text: place.name || place.display_name.split(',')[0],
        secondary_text: place.display_name
      },
      // Include coordinates directly in the prediction to avoid needing place details
      geometry: {
        location: {
          lat: parseFloat(place.lat),
          lng: parseFloat(place.lon)
        }
      },
      osm_data: place // Include original OSM data for details
    }));

    res.json({
      predictions,
      status: 'OK',
      source: 'openstreetmap'
    });

  } catch (error) {
    console.error("Error in places autocomplete:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/details", async (req: CustomRequest, res: Response) => {
  try {
    const { place_id, fields = "place_id,name,formatted_address,geometry" } = req.query;
    
    if (!place_id || typeof place_id !== 'string') {
      return res.status(400).json({ error: "place_id parameter is required" });
    }

    // Check if this is an OpenStreetMap place_id
    if (place_id.startsWith('osm_')) {
      // For OSM places, we need to extract the original OSM data
      // The place_id format is "osm_<index>" where index is the position in the search results
      const osmIndex = place_id.replace('osm_', '');
      
      try {
        // Since we don't have the original OSM data stored, we'll need to re-search
        // This is a limitation - in a production app, you'd want to cache the OSM data
        console.log('OSM place details requested for:', place_id);
        
        // For now, return a generic response - in production, you'd want to store the OSM data
        // or implement a more sophisticated caching mechanism
        return res.status(400).json({ 
          error: "OpenStreetMap place details not available. Please search again." 
        });
      } catch (error) {
        console.error('Error fetching OSM place details:', error);
        return res.status(400).json({ error: "Failed to get place details from OpenStreetMap" });
      }
    }

    // Try Google Places API for non-OSM place_ids
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const useGooglePlaces = process.env.USE_GOOGLE_PLACES !== 'false'; // Default to true
    
    if (!apiKey || !useGooglePlaces) {
      return res.status(500).json({ error: "Google Maps API key not configured or disabled" });
    }

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=${fields}&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Google Places API error:', data);
      return res.status(400).json({ 
        error: "Failed to get place details", 
        details: data.error_message || data.status 
      });
    }

    res.json(data);
  } catch (error) {
    console.error("Error in places details:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
