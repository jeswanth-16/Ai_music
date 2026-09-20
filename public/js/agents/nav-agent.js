/**
 * Techi Voice-Only Navigation Agent
 * Uses Nominatim (OSM) for geocoding, OpenRouteService for routing,
 * and Geolocation API for live voice turn-by-turn guidance without maps.
 */
class NavAgent {
  constructor(speaker) {
    this.speaker = speaker;
    this.isNavigating = false;
    this.destinationName = '';
    this.currentRoute = null;
    this.currentStepIndex = 0;
    this.watchId = null;
    this.currentCoords = null;
    this.spokenSteps = new Set();
  }

  getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error('GEOLOCATION_NOT_SUPPORTED'));
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    });
  }

  async startRouteTo(destinationQuery) {
    if (!destinationQuery || destinationQuery.trim().length === 0) {
      this.speaker.speak("Enga ponum boss? Mention destination name.");
      return;
    }

    this.speaker.speak(`Route calculate panren for ${destinationQuery}, oru second boss.`);

    let userPos;
    try {
      userPos = await this.getCurrentLocation();
      this.currentCoords = userPos;
    } catch (err) {
      console.warn('[NavAgent] Location error:', err);
      // Fallback default coordinates (e.g. Chennai/Coimbatore center for demo if user on desktop denies permission)
      if (err.code === 1) { // PERMISSION_DENIED
        this.speaker.speak("Location permission access thevai boss. Browser la GPS allow pannunga.");
        return;
      } else {
        // Use approximate default location if GPS timeout occurs
        userPos = { lat: 11.0168, lon: 76.9558 }; // Coimbatore default
        this.currentCoords = userPos;
      }
    }

    try {
      // 1. Geocode with Nominatim
      const geocodeUrl = `/api/nav/geocode?q=${encodeURIComponent(destinationQuery)}&lat=${userPos.lat}&lon=${userPos.lon}`;
      const geoRes = await fetch(geocodeUrl);
      const geoData = await geoRes.json();

      if (geoData.error || !geoData.results || geoData.results.length === 0) {
        this.speaker.speak(`Andha edam kedaikala boss for ${destinationQuery}. Please place name sariya sollunga.`);
        return;
      }

      const targetPlace = geoData.results[0];
      this.destinationName = targetPlace.name.split(',')[0]; // short place name

      // 2. Route calculation with OpenRouteService
      const routeRes = await fetch('/api/nav/directions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: [userPos.lon, userPos.lat],
          end: [targetPlace.lon, targetPlace.lat]
        })
      });

      const routeData = await routeRes.json();

      if (routeData.error) {
        if (routeData.error === 'NO_KEY') {
          this.speaker.speak("OpenRouteService API key is missing in dot env file.");
        } else {
          this.speaker.speak("Route calculate panna mudiyala boss. Please check destination.");
        }
        return;
      }

      this.currentRoute = routeData;
      this.currentStepIndex = 0;
      this.spokenSteps.clear();
      this.isNavigating = true;

      const km = (routeData.distance / 1000).toFixed(1);
      const mins = Math.round(routeData.duration / 60);

      // Announce route start
      this.speaker.speak(`Route ready boss for ${this.destinationName}. Total distance ${km} kilometer, approximately ${mins} minutes aagum.`);

      // Speak first step instruction
      if (routeData.steps && routeData.steps.length > 0) {
        const firstStep = routeData.steps[0];
        const spokenInst = this.translateInstruction(firstStep.instruction, firstStep.distance);
        setTimeout(() => {
          this.speaker.speak(spokenInst);
        }, 3500);
      }

      // Start live movement tracking
      this.startTracking();

    } catch (err) {
      console.error('[NavAgent] Route setup error:', err);
      this.speaker.speak("Navigation connection error boss.");
    }
  }

  startTracking() {
    if (!navigator.geolocation) return;

    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
    }

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.onLocationUpdate(pos.coords.latitude, pos.coords.longitude),
      (err) => console.warn('[NavAgent] Watch error:', err),
      { enableHighAccuracy: true, maximumAge: 3000 }
    );
  }

  onLocationUpdate(lat, lon) {
    this.currentCoords = { lat, lon };

    if (!this.isNavigating || !this.currentRoute || !this.currentRoute.steps) return;

    // Check next upcoming turn step
    const steps = this.currentRoute.steps;
    if (this.currentStepIndex < steps.length) {
      const step = steps[this.currentStepIndex];

      // If step hasn't been spoken yet and within alert threshold
      if (!this.spokenSteps.has(this.currentStepIndex)) {
        this.spokenSteps.add(this.currentStepIndex);
        const alertText = this.translateInstruction(step.instruction, step.distance);
        this.speaker.speak(alertText);
      }
    }
  }

  translateInstruction(instruction, distanceMeters) {
    if (!instruction) return "Continue straight boss.";

    const d = Math.round(distanceMeters || 100);
    const distText = d > 999 ? `${(d / 1000).toFixed(1)} kilometer la` : `${d} meter la`;

    let text = instruction.toLowerCase();

    if (text.includes('turn right') || text.includes('sharp right')) {
      return `${distText} right thiruppunga.`;
    } else if (text.includes('turn left') || text.includes('sharp left')) {
      return `${distText} left thiruppunga.`;
    } else if (text.includes('keep right')) {
      return `${distText} right side lane la ponga.`;
    } else if (text.includes('keep left')) {
      return `${distText} left side lane la ponga.`;
    } else if (text.includes('straight') || text.includes('continue')) {
      return `${d} meters straight ah drive pannunga.`;
    } else if (text.includes('roundabout')) {
      return `${distText} roundabout edunga.`;
    } else if (text.includes('arrive') || text.includes('destination')) {
      return "Destination vandhachu boss!";
    }

    return `${distText}, ${instruction}.`;
  }

  askDistance() {
    if (!this.isNavigating || !this.currentRoute) {
      this.speaker.speak("Navigation ippo active-ah illai boss. Enga ponum nu sollunga.");
      return;
    }

    const km = (this.currentRoute.distance / 1000).toFixed(1);
    const mins = Math.round(this.currentRoute.duration / 60);
    this.speaker.speak(`Innum ${km} kilometer irukku boss. Approximately ${mins} minutes aagum.`);
  }

  stopNavigation() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isNavigating = false;
    this.currentRoute = null;
    this.currentStepIndex = 0;
    this.spokenSteps.clear();
    this.speaker.speak("Navigation stopped boss.");
  }

  // Placeholder for "nearby charging station" connectable via techi.updateData()
  findNearbyChargingStation() {
    this.speaker.speak("Nearest EV charging station theduren boss.");
    this.startRouteTo("EV charging station");
  }
}

window.NavAgent = NavAgent;
