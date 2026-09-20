# Techi - Standalone AI Voice Assistant

A voice-only AI assistant website for electric vehicles, featuring an animated reactive AI orb/waveform in the center, continuous hands-free speech recognition in Tamil, Tanglish, and English, Google Gemini AI reasoning, YouTube audio playback, OpenRouteService turn-by-turn navigation, and contact dialing.

---

## Strict Scope & UI Design

- **Visuals**: Displays **ONLY** the single central animated AI orb and waveform.
  - Reacts to 4 dynamic states: `idle` (gentle pulse), `listening` (reactive audio waves), `thinking` (spinning vortex), and `speaking` (vocal waveform).
  - Starts with a minimalist "Tap to start" screen to initialize browser audio permissions.
  - Zero clutter: No dashboard, no buttons, no chat text, no map, and no visible video player.
- **Voice-First**:
  - Continuous listening via Chrome Web Speech API.
  - Audio-only YouTube music with automatic ducking when Techi speaks.
  - Voice turn-by-turn navigation using OpenStreetMap Nominatim and OpenRouteService (no visual map).
  - Phone dialing via `tel:` links using editable `contacts.json`.
  - All errors and notifications are spoken aloud by Techi.

---

## Quick Start

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **Google Chrome** browser (for Web Speech API support)

### 2. Setup & Configuration

1. Clone or open this repository in terminal:
   ```bash
   cd e:/AI_Voice
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your API keys in `.env` (copied from `.env.example`):
   ```ini
   # Google Gemini API Key (Get free key from https://aistudio.google.com/)
   GEMINI_API_KEY=your_gemini_api_key_here

   # YouTube Data API v3 Key (Get free key from https://console.cloud.google.com/)
   YOUTUBE_API_KEY=your_youtube_api_key_here

   # OpenRouteService API Key (Get free key from https://openrouteservice.org/dev/#/signup)
   ORS_API_KEY=your_ors_api_key_here

   # Port (Optional, default: 3000)
   PORT=3000
   ```

   > [!NOTE]
   > Even without API keys configured immediately, Techi will run and speak voice errors explaining which key is needed for each service, and provides instant built-in responses for greetings, contacts, and vehicle telemetry.

4. Start the server:
   ```bash
   npm start
   ```

5. Open Google Chrome and navigate to:
   ```
   http://localhost:3000
   ```

6. **Tap anywhere** on the screen to grant microphone permission and wake Techi.

---

## Supported Voice Commands

You can speak to Techi naturally in **Tamil, Tanglish, or English**:

| Feature | Spoken Commands (Tamil / Tanglish / English) | Expected Behavior |
| :--- | :--- | :--- |
| **Music Play** | `"play Anirudh songs"`, `"oru melody song podu"`, `"Arabic Kuthu podu"` | Searches YouTube Data API v3, queues 10 tracks, and plays track 1 in hidden audio player. |
| **Music Next** | `"next song"`, `"adutha paattu"`, `"next track"`, `"next"` | Plays next song in the 10-track queue immediately without a new API call. |
| **Music Pause** | `"pause"`, `"pause pannu"`, `"paatta nillu"` | Pauses the audio player. |
| **Music Resume**| `"resume"`, `"continue"`, `"marupadiyum podu"` | Resumes playback. |
| **Music Stop** | `"stop"`, `"stop music"`, `"paatta niruthu"` | Stops playback and clears the queue. |
| **Volume Control** | `"volume kammi pannu"`, `"volume low"`, `"volume increase pannu"` | Decreases/increases volume by 20%. |
| **Audio Ducking** | *(Automatic during any speech)* | Music volume automatically lowers to ~15% while Techi is speaking, then restores. |
| **Navigation** | `"Coimbatore-ku route sollu"`, `"route to Chennai"`, `"nearest petrol bunk"` | Geocodes via Nominatim, calculates route with ORS, announces distance/duration, and begins turn-by-turn guidance. |
| **Distance Query**| `"evlo dhooram"`, `"how far"`, `"distance evlo"` | Speaks remaining distance and ETA. |
| **Navigation Stop**| `"navigation stop"`, `"stop navigation"`, `"route stop"` | Stops GPS tracking and clears route. |
| **Calling** | `"amma-ku call pannu"`, `"call Rahul"`, `"dial Priya"` | Looks up contact in `contacts.json` and launches phone dialer via `tel:`. |
| **Missing Contact**| `"call Suresh"` (name not in `contacts.json`) | Techi asks by voice: *"Andha name contacts list-la illai boss. Yaarukku call pannanum nu sollunga?"* |
| **Vehicle Battery**| `"battery evlo irukku"`, `"battery percentage"`, `"range evlo"` | Speaks real-time battery % and remaining range in Tamil/English. |
| **Motor Status** | `"motor epdi irukku"`, `"motor status"`, `"speed evlo"` | Speaks motor driving mode, speed, and status. |
| **Driver Wellness**| `"wellness status"`, `"am I tired"` | Speaks driver alertness and heart rate. |
| **General AI Chat**| `"Who are you?"`, `"Vanakkam"`, `"Tell me a joke"`, chit-chat | Processed by Gemini API, returning crisp 1-2 sentence JARVIS-style replies. |

---

## Developer API (`window.techi`)

Techi exposes a global JavaScript interface on `window.techi` for feeding live sensor data, triggering voice alerts, and inspecting state.

Open the browser developer console (`F12`) to try these out:

### 1. Feed Live Sensor Values: `techi.updateData(data)`

Use `techi.updateData({...})` to update EV telemetry (e.g. from CAN bus, OBD-II, or ESP32 bridge):

```javascript
// Update battery telemetry
techi.updateData({
  battery: {
    percentage: 42,
    rangeKm: 130,
    temperature: 36
  }
});

// Update motor telemetry
techi.updateData({
  motor: {
    mode: 'Sport',
    speedKmh: 75,
    temperature: 52
  }
});

// Update driver wellness telemetry (triggers drowsiness warning & mood music if fatigued)
techi.updateData({
  driver: {
    alertness: 'Drowsy',
    fatigueRisk: 'High'
  }
});
```

### 2. Trigger Spoken Voice Alerts: `techi.speak(text)`

Use `techi.speak(text)` to trigger immediate voice alerts:

```javascript
// Spoken alert in Tanglish / Tamil
techi.speak("Warning boss, tire pressure low-ah irukku. Please check pannunga.");

// Spoken alert in English
techi.speak("Battery level is critically low. Searching for nearest charging station.");
```

### 3. Programmatic Command Execution: `techi.processCommand(text)`

Execute any voice command directly via code:

```javascript
techi.processCommand("play Anirudh songs");
techi.processCommand("battery evlo irukku");
techi.processCommand("amma-ku call pannu");
```

### 4. Inspect Current State: `techi.getState()`

Returns an object containing current orb state, navigation status, queued track info, and telemetry:

```javascript
console.log(techi.getState());
```

---

## Contacts Configuration (`contacts.json`)

Edit `contacts.json` to add or update your phone contacts:

```json
[
  {
    "name": "Amma",
    "aliases": ["amma", "mom", "mother"],
    "number": "+919876543210"
  },
  {
    "name": "Appa",
    "aliases": ["appa", "dad", "father"],
    "number": "+919876543211"
  },
  {
    "name": "Rahul",
    "aliases": ["rahul", "friend"],
    "number": "+919876543212"
  }
]
```

---

## Automated Verification

To run the automated tests covering all mini-agents, routing, and voice commands:

```bash
node scratch/test-agents.js
```
*(All 39 automated tests pass with 0 errors)*
