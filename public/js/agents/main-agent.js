/**
 * Techi Main Agent (The Brain)
 * Directs voice intents to Music, Navigation, Calling, and Telemetry Mini-Agents,
 * or sends conversational queries to Gemini API.
 */
class MainAgent {
  constructor({ speaker, orb, musicAgent, navAgent, callAgent, batteryAgent, motorAgent, wellnessAgent }) {
    this.speaker = speaker;
    this.orb = orb;
    this.musicAgent = musicAgent;
    this.navAgent = navAgent;
    this.callAgent = callAgent;
    this.batteryAgent = batteryAgent;
    this.motorAgent = motorAgent;
    this.wellnessAgent = wellnessAgent;

    this.conversationHistory = [];
  }

  async handleUserInput(text) {
    if (!text || text.trim().length === 0) return;

    const query = text.trim();
    const lower = query.toLowerCase();
    console.log('[MainAgent] Processing command:', query);

    // If CallAgent is waiting for contact clarification
    if (this.callAgent && this.callAgent.waitingForContactName) {
      if (lower === 'cancel' || lower === 'vendaam' || lower === 'stop' || lower.includes('cancel')) {
        this.callAgent.waitingForContactName = false;
        this.speaker.speak("Call cancelled boss.");
        return;
      }
      // If user switches topic (e.g. music, navigation, battery), cancel waiting and proceed
      const isSwitchingIntent = lower.includes('song') || lower.includes('paattu') || lower.includes('music') ||
        lower.includes('pause') || lower.includes('resume') || lower.includes('volume') ||
        lower.includes('route') || lower.includes('dhooram') || lower.includes('battery') || lower.includes('motor');

      if (isSwitchingIntent) {
        this.callAgent.waitingForContactName = false;
      } else {
        await this.callAgent.handleCallCommand(query);
        return;
      }
    }

    // --- 1. CALLING INTENTS ---
    if (lower.includes('call') || lower.includes('phone pannu') || lower.includes('dial') || lower.includes('ku call')) {
      await this.callAgent.handleCallCommand(query);
      return;
    }

    // --- 2. MUSIC INTENTS ---
    // Next song
    if (lower.includes('next song') || lower.includes('adutha paattu') || lower.includes('next track') || lower === 'next') {
      this.musicAgent.playNext();
      return;
    }

    // Pause music
    if (lower.includes('pause') || lower.includes('nillu') || lower.includes('stop the song')) {
      this.musicAgent.pause();
      return;
    }

    // Resume music
    if (lower.includes('resume') || lower.includes('continue the song') || lower.includes('marupadiyum podu')) {
      this.musicAgent.resume();
      return;
    }

    // Stop music
    if (lower === 'stop' || lower === 'stop music' || lower.includes('music stop') || lower.includes('paatta niruthu')) {
      this.musicAgent.stop();
      return;
    }

    // Volume adjustments
    if (lower.includes('volume kammi') || lower.includes('volume low') || lower.includes('volume down') || lower.includes('sound kammi')) {
      this.musicAgent.volumeDown();
      return;
    }
    if (lower.includes('volume increase') || lower.includes('volume athigam') || lower.includes('volume up') || lower.includes('sound increase')) {
      this.musicAgent.volumeUp();
      return;
    }

    // Play song search
    if (lower.startsWith('play ') || lower.includes('song podu') || lower.includes('paattu podu') || lower.includes('songs podu') || lower.includes('play music')) {
      let songQuery = query
        .replace(/^(techi|hey techi|hi techi)\s*/i, '')
        .replace(/^(play|podu)\s*/i, '')
        .replace(/(song podu|paattu podu|songs podu|podu|songs|song)/gi, '')
        .trim();

      if (!songQuery) songQuery = "trending tamil songs";
      this.orb.setState('thinking');
      await this.musicAgent.searchAndPlay(songQuery);
      return;
    }

    // --- 3. NAVIGATION INTENTS ---
    // Stop navigation
    if (lower.includes('navigation stop') || lower.includes('stop navigation') || lower.includes('route stop') || lower.includes('cancel route')) {
      this.navAgent.stopNavigation();
      return;
    }

    // Ask distance / ETA
    if (lower.includes('evlo dhooram') || lower.includes('how far') || lower.includes('distance') || lower.includes('remaining distance') || lower.includes('reach aaga evlo neram')) {
      this.navAgent.askDistance();
      return;
    }

    // Charging station
    if (lower.includes('charging station') || lower.includes('charging point') || lower.includes('charge podanum')) {
      this.navAgent.findNearbyChargingStation();
      return;
    }

    // Route to place / petrol bunk
    if (lower.includes('route') || lower.includes('direction') || lower.includes('navigate') || lower.includes('vazhi') || lower.includes('petrol bunk')) {
      let destination = query
        .replace(/^(techi|hey techi|hi techi)\s*/i, '')
        .replace(/(route sollu|route kaatu|route to|direction to|navigate to|ku route|ku vazhi|vazhi sollu|sollu)/gi, '')
        .replace(/(\-ku|ku|kku|ukku)/gi, '')
        .trim();

      if (lower.includes('petrol bunk')) {
        destination = 'petrol bunk';
      }

      this.orb.setState('thinking');
      await this.navAgent.startRouteTo(destination);
      return;
    }

    // --- 4. BATTERY & EV TELEMETRY INTENTS ---
    if (lower.includes('battery') || lower.includes('charge evlo') || lower.includes('range') || lower.includes('kilometers polam')) {
      const bat = this.batteryAgent.getStatus();
      const isTamil = /[\u0B80-\u0BFF]/.test(query) || lower.includes('evlo') || lower.includes('irukku');
      const response = isTamil
        ? `Battery ${bat.percentage} percent irukku boss. Range approximately ${bat.rangeKm} kilometers polam.`
        : `Battery is at ${bat.percentage} percent with an estimated range of ${bat.rangeKm} kilometers.`;
      this.speaker.speak(response);
      return;
    }

    if (lower.includes('motor') || lower.includes('speed') || lower.includes('rpm')) {
      const mot = this.motorAgent.getStatus();
      const isTamil = lower.includes('epdi') || lower.includes('evlo');
      const response = isTamil
        ? `Motor ${mot.mode} mode la ${mot.speedKmh} km/h speed la run aaguthu boss.`
        : `Motor is running in ${mot.mode} mode at ${mot.speedKmh} km/h. Temperature is normal.`;
      this.speaker.speak(response);
      return;
    }

    if (lower.includes('wellness') || lower.includes('health') || lower.includes('driver status') || lower.includes('tired')) {
      const well = this.wellnessAgent.getStatus();
      const response = `Driver alertness level is ${well.alertness}. Heart rate is ${well.heartRate} bpm. You are doing great boss!`;
      this.speaker.speak(response);
      return;
    }

    // --- 5. GENERAL AI REASONING / GEMINI BRAIN ---
    this.orb.setState('thinking');
    await this.askGemini(query);
  }

  async askGemini(promptText) {
    const lower = promptText.toLowerCase().trim();

    // Fast conversational replies for basic greetings
    if (lower.includes('who are you') || lower.includes('neenga yaaru') || lower.includes('unar peyar enna')) {
      this.speaker.speak("Naan Techi, unga EV AI voice assistant boss! Music, navigation, calling, ellam naan paathukren.");
      return;
    }
    if (lower === 'hi' || lower === 'hello' || lower === 'vanakkam' || lower.includes('hey techi') || lower.includes('hi techi')) {
      this.speaker.speak("Vanakkam boss! Enna pannanum சொல்லுங்க, I am ready.");
      return;
    }
    if (lower.includes('how are you') || lower.includes('epdi irukkeenga') || lower.includes('epdi irukka')) {
      this.speaker.speak("Naan super ah irukken boss! Unga car systems ellam peak condition la ready-ah irukku.");
      return;
    }

    try {
      const bat = this.batteryAgent.getStatus();
      const mot = this.motorAgent.getStatus();
      const navStatus = this.navAgent.isNavigating ? `Navigating to ${this.navAgent.destinationName}` : 'Not navigating';

      const systemContext = `You are "Techi", a brilliant, ultra-friendly, JARVIS-like AI voice assistant for an electric vehicle.
Current EV State: Battery ${bat.percentage}%, Range ${bat.rangeKm} km, Motor ${mot.mode} mode (${mot.speedKmh} km/h), Navigation: ${navStatus}.
CRITICAL VOICE ASSISTANT RULES:
1. Always keep responses short and crisp: exactly 1 to 2 sentences maximum.
2. Mirror the user's language: if Tamil or Tanglish, reply warmly in natural spoken Tanglish/Tamil (e.g., "Kandippa boss", "Seringa boss", "Naan paathukren"). If English, reply in polished JARVIS-like English.
3. Absolutely NO markdown formatting (no asterisks, no bullets, no quotes).`;

      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          systemContext: systemContext,
          history: this.conversationHistory.slice(-4)
        })
      });

      const data = await response.json();

      if (data.error) {
        if (data.error === 'NO_KEY') {
          this.speaker.speak("Gemini API key is missing in dot env file. But I can still play music, navigate, and make calls!");
        } else {
          this.speaker.speak("Sorry boss, AI brain connect panna mudiyala. But your vehicle systems are active.");
        }
        return;
      }

      if (data.reply) {
        this.conversationHistory.push({ role: 'user', parts: [{ text: promptText }] });
        this.conversationHistory.push({ role: 'model', parts: [{ text: data.reply }] });

        this.speaker.speak(data.reply);
      } else {
        this.speaker.speak("Sollinga boss, enna help venum?");
      }

    } catch (err) {
      console.error('[MainAgent] Gemini request error:', err);
      this.speaker.speak("Network connection problem boss. Please check your internet.");
    }
  }
}

window.MainAgent = MainAgent;
