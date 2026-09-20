require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuration status endpoint
app.get('/api/config', (req, res) => {
  res.json({
    gemini: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0,
    youtube: !!process.env.YOUTUBE_API_KEY && process.env.YOUTUBE_API_KEY.trim().length > 0,
    ors: !!process.env.ORS_API_KEY && process.env.ORS_API_KEY.trim().length > 0
  });
});

// Contacts endpoint
app.get('/api/contacts', (req, res) => {
  try {
    const contactsPath = path.join(__dirname, 'contacts.json');
    if (!fs.existsSync(contactsPath)) {
      return res.json([]);
    }
    const data = fs.readFileSync(contactsPath, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    console.error('Error reading contacts:', err);
    res.status(500).json({ error: 'Failed to read contacts' });
  }
});

// Music Search endpoint (YouTube Data API v3)
app.get('/api/music/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Query parameter q is required' });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return res.status(400).json({ error: 'NO_KEY', message: 'YouTube API key is missing' });
  }

  try {
    const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(query)}&key=${apiKey}`;
    const response = await fetch(ytUrl);
    const data = await response.json();

    if (data.error) {
      console.error('YouTube API error:', data.error);
      if (data.error.errors && data.error.errors.some(e => e.reason === 'quotaExceeded')) {
        return res.status(429).json({ error: 'QUOTA_EXCEEDED', message: 'YouTube quota exceeded' });
      }
      return res.status(500).json({ error: 'API_ERROR', message: data.error.message });
    }

    const tracks = (data.items || []).map(item => ({
      id: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.default?.url
    }));

    if (tracks.length === 0) {
      return res.json({ tracks: [], message: 'NOT_FOUND' });
    }

    res.json({ tracks });
  } catch (err) {
    console.error('YouTube search fetch failed:', err);
    res.status(500).json({ error: 'NETWORK_ERROR', message: 'Failed to connect to YouTube' });
  }
});

// Nominatim Geocoding endpoint
app.get('/api/nav/geocode', async (req, res) => {
  const query = req.query.q;
  const nearLat = req.query.lat;
  const nearLon = req.query.lon;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter q is required' });
  }

  try {
    let url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`;
    // If location bias is provided
    if (nearLat && nearLon) {
      const viewbox = `${parseFloat(nearLon) - 0.2},${parseFloat(nearLat) + 0.2},${parseFloat(nearLon) + 0.2},${parseFloat(nearLat) - 0.2}`;
      url += `&viewbox=${viewbox}&bounded=0`;
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TechiVoiceAssistant/1.0 (techi-assistant@local.dev)',
        'Accept-Language': 'en,ta'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'GEOCODE_ERROR', message: 'Nominatim error' });
    }

    const data = await response.json();
    if (!data || data.length === 0) {
      return res.json({ results: [], message: 'NOT_FOUND' });
    }

    const results = data.map(item => ({
      name: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      type: item.type,
      importance: item.importance
    }));

    res.json({ results });
  } catch (err) {
    console.error('Nominatim geocode failed:', err);
    res.status(500).json({ error: 'NETWORK_ERROR', message: 'Nominatim geocoding failed' });
  }
});

// OpenRouteService Directions endpoint
app.post('/api/nav/directions', async (req, res) => {
  const { start, end } = req.body;
  // start: [lon, lat], end: [lon, lat]
  if (!start || !end || !Array.isArray(start) || !Array.isArray(end)) {
    return res.status(400).json({ error: 'start and end coordinates [lon, lat] required' });
  }

  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return res.status(400).json({ error: 'NO_KEY', message: 'OpenRouteService API key is missing' });
  }

  try {
    const orsUrl = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';
    const response = await fetch(orsUrl, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        coordinates: [start, end],
        instructions: true,
        language: 'en'
      })
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      console.error('ORS API error:', data);
      return res.status(response.status || 500).json({ error: 'ORS_ERROR', details: data });
    }

    const feature = data.features && data.features[0];
    if (!feature) {
      return res.status(404).json({ error: 'NO_ROUTE', message: 'No route found' });
    }

    const summary = feature.properties.summary;
    const segments = feature.properties.segments || [];
    const steps = segments.flatMap(s => s.steps || []).map(step => ({
      instruction: step.instruction,
      distance: step.distance, // meters
      duration: step.duration, // seconds
      type: step.type,
      name: step.name,
      way_points: step.way_points
    }));

    res.json({
      distance: summary.distance, // in meters
      duration: summary.duration, // in seconds
      steps: steps,
      geometry: feature.geometry
    });
  } catch (err) {
    console.error('ORS directions failed:', err);
    res.status(500).json({ error: 'NETWORK_ERROR', message: 'Failed to connect to OpenRouteService' });
  }
});

// Gemini Chat endpoint
app.post('/api/gemini/chat', async (req, res) => {
  const { prompt, systemContext, history } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return res.status(400).json({ error: 'NO_KEY', message: 'Gemini API key is missing' });
  }

  const systemInstructionText = systemContext || `You are "Techi", an ultra-intelligent, friendly, JARVIS-like AI voice assistant for an electric vehicle.
You understand and respond naturally in Tamil, Tanglish, and English, matching whichever language the user speaks.
STRICT RULES:
1. Always keep responses short and crisp: exactly 1 to 2 sentences maximum.
2. Be warm, polite, and helpful (like JARVIS).
3. If speaking in Tamil/Tanglish, use natural spoken Tamil (e.g. "Kandippa boss", "Seringa", "Ippo play panren").
4. Never output markdown formatting, bullet points, asterisks, or long paragraphs, because your text will be read aloud by browser Text-To-Speech.`;

  // Try gemini-2.0-flash first, fallback to gemini-1.5-flash
  const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];

  for (const model of models) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstructionText }]
          },
          contents: [
            ...(history || []),
            { role: 'user', parts: [{ text: prompt }] }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 150
          }
        })
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        console.warn(`Model ${model} returned error:`, data.error?.message);
        continue; // try next model
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      return res.json({ reply: text, model: model });
    } catch (err) {
      console.warn(`Failed with model ${model}:`, err.message);
    }
  }

  return res.status(500).json({ error: 'GEMINI_ERROR', message: 'Gemini API call failed across models' });
});

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`Techi Voice Assistant server is running at http://localhost:${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is in use, trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(PORT);

module.exports = app;
