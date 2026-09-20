/**
 * Techi Speech Engine
 * Manages Web Speech Recognition (Chrome) and SpeechSynthesis with Voice Ducking
 */
class SpeechEngine {
  constructor(options = {}) {
    this.onTranscript = options.onTranscript || (() => {});
    this.onStateChange = options.onStateChange || (() => {});
    this.onDuckMusic = options.onDuckMusic || (() => {});

    this.recognition = null;
    this.isListening = false;
    this.isSpeaking = false;
    this.shouldListen = false;
    this.voices = [];

    this.initVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => this.initVoices();
    }
  }

  initVoices() {
    if ('speechSynthesis' in window) {
      this.voices = window.speechSynthesis.getVoices();
    }
  }

  getBestVoice(text) {
    if (!this.voices || this.voices.length === 0) {
      this.initVoices();
    }

    const hasTamilUnicode = /[\u0B80-\u0BFF]/.test(text);

    if (hasTamilUnicode) {
      // Find Tamil voice
      const taVoice = this.voices.find(v => v.lang.toLowerCase().includes('ta') || v.name.toLowerCase().includes('tamil'));
      if (taVoice) return taVoice;
    }

    // Prefer Indian English voice for natural Tanglish/English accent
    const enInVoice = this.voices.find(v =>
      v.lang === 'en-IN' ||
      v.name.includes('India') ||
      v.name.includes('Neerja') ||
      v.name.includes('Heera') ||
      v.name.includes('Ravi')
    );
    if (enInVoice) return enInVoice;

    // Fallback to any natural English voice
    const enVoice = this.voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural')));
    if (enVoice) return enVoice;

    return this.voices.find(v => v.lang.startsWith('en')) || this.voices[0] || null;
  }

  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('Web Speech API is not supported in this browser.');
      this.speak("Browser does not support speech recognition. Please use Google Chrome.");
      return false;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    // en-IN allows English and Tanglish transliteration seamlessly in Chrome
    this.recognition.lang = 'en-IN';
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isListening = true;
      if (!this.isSpeaking) {
        this.onStateChange('listening');
      }
    };

    this.recognition.onresult = (event) => {
      if (this.isSpeaking) return; // Prevent echo while assistant is talking

      const lastResultIndex = event.results.length - 1;
      const transcript = event.results[lastResultIndex][0].transcript.trim();

      if (transcript.length > 0) {
        console.log('[Techi Heard]:', transcript);
        this.onTranscript(transcript);
      }
    };

    this.recognition.onerror = (event) => {
      console.warn('[Speech Recognition Error]:', event.error);
      if (event.error === 'not-allowed') {
        this.shouldListen = false;
        this.speak("Microphone permission denied. Please allow microphone access in your browser settings.");
      } else if (event.error === 'network') {
        // Can happen temporarily, will retry
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      // Auto-restart continuous listening if not intentionally stopped or currently speaking
      if (this.shouldListen && !this.isSpeaking) {
        try {
          this.recognition.start();
        } catch (e) {
          setTimeout(() => {
            if (this.shouldListen && !this.isSpeaking) {
              try { this.recognition.start(); } catch (err) {}
            }
          }, 400);
        }
      }
    };

    return true;
  }

  startListening() {
    this.shouldListen = true;
    if (!this.recognition) {
      const ok = this.initRecognition();
      if (!ok) return;
    }

    try {
      this.recognition.start();
    } catch (e) {
      // Already running or starting
    }
  }

  stopListening() {
    this.shouldListen = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
  }

  speak(text, onComplete) {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported');
      if (onComplete) onComplete();
      return;
    }

    if (!text || text.trim().length === 0) {
      if (onComplete) onComplete();
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Clean text of emojis or formatting
    const cleanText = text
      .replace(/[*_#`~]/g, '')
      .replace(/[\u{1F600}-\u{1F64F}|\u{1F300}-\u{1F5FF}|\u{1F680}-\u{1F6FF}|\u{2600}-\u{26FF}]/gu, '')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.voice = this.getBestVoice(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.onDuckMusic(true);
      this.onStateChange('speaking');
    };

    const finish = () => {
      this.isSpeaking = false;
      this.onDuckMusic(false);
      this.onStateChange('listening');

      // Resume listening
      if (this.shouldListen) {
        try {
          this.recognition.start();
        } catch (e) {}
      }

      if (onComplete) onComplete();
    };

    utterance.onend = finish;
    utterance.onerror = (e) => {
      console.warn('Speech synthesis utterance error:', e);
      finish();
    };

    window.speechSynthesis.speak(utterance);
  }
}

window.SpeechEngine = SpeechEngine;
