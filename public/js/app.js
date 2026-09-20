/**
 * Techi AI Assistant - Application Bootstrap & Public API
 */

document.addEventListener('DOMContentLoaded', () => {
  const startScreen = document.getElementById('start-screen');
  const orb = new OrbVisualizer('orb-canvas');

  let audioContext = null;
  let micStream = null;

  // 1. Initialize Speech Engine
  const speaker = new SpeechEngine({
    onTranscript: (text) => {
      if (mainAgent) {
        mainAgent.handleUserInput(text);
      }
    },
    onStateChange: (state) => {
      orb.setState(state);
    },
    onDuckMusic: (isDucking) => {
      if (musicAgent) {
        musicAgent.duck(isDucking);
      }
    }
  });

  // 2. Initialize Mini-Agents
  const musicAgent = new MusicAgent(speaker);
  const navAgent = new NavAgent(speaker);
  const callAgent = new CallAgent(speaker);
  const batteryAgent = new BatteryAgent();
  const motorAgent = new MotorAgent();
  const wellnessAgent = new DriverWellnessAgent(speaker, musicAgent);

  // 3. Initialize Main Agent
  const mainAgent = new MainAgent({
    speaker,
    orb,
    musicAgent,
    navAgent,
    callAgent,
    batteryAgent,
    motorAgent,
    wellnessAgent
  });

  // 4. Setup Audio Context & Mic Stream for Reactive Orb
  async function startAudioInput() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }

        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = audioContext.createMediaStreamSource(micStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);

        orb.setAudioAnalyser(analyser);
      }
    } catch (err) {
      console.warn('[AudioContext] Mic audio visualizer fallback:', err);
    }
  }

  // 5. User Initial Tap to Start
  let started = false;
  async function wakeTechi() {
    if (started) return;
    started = true;

    // Fade out start screen
    startScreen.classList.add('hidden');

    // Initialize audio reactivity
    await startAudioInput();

    // Start speech recognition
    speaker.startListening();

    // Welcome Greeting
    setTimeout(() => {
      speaker.speak("Vanakkam boss! Techi is online. Sollinga, enna pannanum?");
    }, 400);
  }

  startScreen.addEventListener('click', wakeTechi);
  startScreen.addEventListener('touchstart', wakeTechi);

  // 6. Expose Public Global Interface
  window.techi = {
    // Feed sensor values
    updateData: (data) => {
      if (!data) return;
      if (data.battery) batteryAgent.update(data.battery);
      if (data.motor) motorAgent.update(data.motor);
      if (data.driver || data.wellness) wellnessAgent.update(data.driver || data.wellness);
      console.log('[Techi] Sensor data updated:', data);
    },

    // Trigger an alert or speech by voice
    speak: (text) => {
      speaker.speak(text);
    },

    // Process a text command programmatically (for tests or external trigger)
    processCommand: (text) => {
      mainAgent.handleUserInput(text);
    },

    // Get current status of all agents
    getState: () => ({
      orbState: orb.getState(),
      isNavigating: navAgent.isNavigating,
      currentDestination: navAgent.destinationName,
      musicTrack: musicAgent.queue[musicAgent.currentIndex] || null,
      musicQueueLength: musicAgent.queue.length,
      battery: batteryAgent.getStatus(),
      motor: motorAgent.getStatus(),
      driver: wellnessAgent.getStatus()
    }),

    // Direct mini-agent references
    agents: {
      main: mainAgent,
      music: musicAgent,
      nav: navAgent,
      call: callAgent,
      battery: batteryAgent,
      motor: motorAgent,
      wellness: wellnessAgent,
      speaker: speaker,
      orb: orb
    }
  };

  console.log('[Techi] Initialized. window.techi ready.');
});
