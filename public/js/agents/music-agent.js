/**
 * Techi Music Agent
 * Manages YouTube audio playback, 10-track queue, volume ducking, and voice controls
 */
class MusicAgent {
  constructor(speaker) {
    this.speaker = speaker; // Reference to Techi's speech engine
    this.player = null;
    this.isReady = false;
    this.queue = [];
    this.currentIndex = -1;
    this.currentVolume = 80;
    this.previousVolume = 80;
    this.isDucked = false;

    this.initYouTubePlayer();
  }

  initYouTubePlayer() {
    // Check if YT IFrame API is already loaded
    if (window.YT && window.YT.Player) {
      this.createPlayer();
    } else {
      window.onYouTubeIframeAPIReady = () => {
        this.createPlayer();
      };
    }
  }

  createPlayer() {
    try {
      this.player = new YT.Player('yt-player', {
        height: '1',
        width: '1',
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0
        },
        events: {
          onReady: (event) => {
            this.isReady = true;
            this.player.setVolume(this.currentVolume);
            console.log('[MusicAgent] YouTube player ready');
          },
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.ENDED) {
              this.playNext(true); // Auto-advance on track end
            }
          },
          onError: (event) => {
            console.warn('[MusicAgent] YouTube playback error:', event.data);
            // 101/150: video owner does not allow embedding, auto skip to next
            if (event.data === 101 || event.data === 150) {
              if (this.queue.length > 0 && this.currentIndex + 1 < this.queue.length) {
                this.playNext();
              } else {
                this.speaker.speak("This video cannot be played due to copyright restrictions. Skipping.");
              }
            }
          }
        }
      });
    } catch (e) {
      console.error('[MusicAgent] Failed to init player:', e);
    }
  }

  async searchAndPlay(query) {
    if (!query || query.trim().length === 0) {
      this.speaker.speak("Enna paattu play pannanum boss?");
      return;
    }

    try {
      const response = await fetch(`/api/music/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (data.error) {
        if (data.error === 'NO_KEY') {
          this.speaker.speak("YouTube API key is missing in dot env file.");
        } else if (data.error === 'QUOTA_EXCEEDED') {
          this.speaker.speak("YouTube API quota has been exceeded boss.");
        } else {
          this.speaker.speak("Could not search YouTube music right now.");
        }
        return;
      }

      if (!data.tracks || data.tracks.length === 0) {
        this.speaker.speak(`Paattu kedaikala boss for ${query}`);
        return;
      }

      // Store fetched tracks in queue (up to 10)
      this.queue = data.tracks;
      this.currentIndex = 0;
      this.playCurrentTrack();

    } catch (err) {
      console.error('[MusicAgent] Search fetch error:', err);
      this.speaker.speak("Network problem while searching music boss.");
    }
  }

  playCurrentTrack() {
    if (this.currentIndex < 0 || this.currentIndex >= this.queue.length) return;
    const track = this.queue[this.currentIndex];

    if (!this.player || !this.isReady) {
      console.warn('[MusicAgent] Player not ready yet');
      setTimeout(() => this.playCurrentTrack(), 600);
      return;
    }

    try {
      this.player.loadVideoById(track.id);
      this.player.setVolume(this.currentVolume);
      this.player.playVideo();

      // Clean title for speaking (e.g. remove "Official Video", "(Lyrics)", etc.)
      const cleanTitle = track.title
        .replace(/\[.*?\]|\(.*?\)|Official Video|Audio|Lyric|Video|HD/gi, '')
        .trim();

      this.speaker.speak(`Playing ${cleanTitle} boss.`);
    } catch (e) {
      console.error('[MusicAgent] Error loading video:', e);
    }
  }

  playNext(autoEnded = false) {
    if (this.queue.length === 0) {
      if (!autoEnded) this.speaker.speak("Queue la paattu illai boss. Pudhusa paattu podunga.");
      return;
    }

    if (this.currentIndex + 1 < this.queue.length) {
      this.currentIndex++;
      const nextTrack = this.queue[this.currentIndex];
      const cleanTitle = nextTrack.title
        .replace(/\[.*?\]|\(.*?\)|Official Video|Audio|Lyric|Video|HD/gi, '')
        .trim();

      if (!autoEnded) {
        this.speaker.speak(`Next song: ${cleanTitle}`);
      }
      this.player.loadVideoById(nextTrack.id);
      this.player.playVideo();
    } else {
      if (!autoEnded) {
        this.speaker.speak("Queue la last song reached boss.");
      }
    }
  }

  pause() {
    if (this.player && this.isReady) {
      try {
        this.player.pauseVideo();
        this.speaker.speak("Music paused.");
      } catch (e) {
        console.error(e);
      }
    }
  }

  resume() {
    if (this.player && this.isReady) {
      try {
        this.player.playVideo();
        this.speaker.speak("Resuming music boss.");
      } catch (e) {
        console.error(e);
      }
    }
  }

  stop() {
    if (this.player && this.isReady) {
      try {
        this.player.stopVideo();
        this.queue = [];
        this.currentIndex = -1;
        this.speaker.speak("Music stopped.");
      } catch (e) {
        console.error(e);
      }
    }
  }

  setVolume(vol) {
    this.currentVolume = Math.max(0, Math.min(100, vol));
    if (this.player && this.isReady) {
      this.player.setVolume(this.currentVolume);
    }
  }

  volumeUp() {
    this.currentVolume = Math.min(100, this.currentVolume + 20);
    this.setVolume(this.currentVolume);
    this.speaker.speak(`Volume increased to ${this.currentVolume} percent.`);
  }

  volumeDown() {
    this.currentVolume = Math.max(10, this.currentVolume - 20);
    this.setVolume(this.currentVolume);
    this.speaker.speak(`Volume kammi panniten. Now at ${this.currentVolume} percent.`);
  }

  duck(isDucking) {
    if (!this.player || !this.isReady) return;

    if (isDucking && !this.isDucked) {
      this.isDucked = true;
      this.previousVolume = this.currentVolume;
      const duckedVol = Math.round(this.currentVolume * 0.15);
      this.player.setVolume(duckedVol);
    } else if (!isDucking && this.isDucked) {
      this.isDucked = false;
      this.player.setVolume(this.previousVolume);
    }
  }

  // Placeholder for mood-based music connectable via techi.updateData()
  playMoodMusic(mood) {
    console.log(`[MusicAgent] Playing mood-based playlist for mood: ${mood}`);
    const moodQueries = {
      tired: 'energetic upbeat tamil dance songs',
      drowsy: 'high energy tamil fast beat songs',
      stressed: 'relaxing ilayaraja instrumental melody',
      happy: 'trending tamil party hits',
      chill: 'soft tamil acoustic melodies'
    };
    const query = moodQueries[mood.toLowerCase()] || `${mood} tamil songs`;
    this.speaker.speak(`Playing energetic music to keep you refreshed boss.`);
    this.searchAndPlay(query);
  }
}

window.MusicAgent = MusicAgent;
