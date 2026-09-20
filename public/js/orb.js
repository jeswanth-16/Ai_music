/**
 * Techi AI Animated Orb & Waveform Visualizer
 * Reacts to 4 states: idle, listening, thinking, speaking
 */
class OrbVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.state = 'idle'; // idle | listening | thinking | speaking
    this.targetState = 'idle';

    // State transition smoothing
    this.stateBlend = {
      idle: 1,
      listening: 0,
      thinking: 0,
      speaking: 0
    };

    // Color palettes for states
    this.palettes = {
      idle: {
        core: [0, 210, 255],        // Cyan
        outer: [20, 80, 200],       // Deep Blue
        particles: [100, 230, 255]
      },
      listening: {
        core: [0, 255, 170],        // Neon Turquoise / Emerald
        outer: [0, 180, 220],       // Electric Blue
        particles: [150, 255, 210]
      },
      thinking: {
        core: [180, 80, 255],       // Violet
        outer: [255, 50, 150],      // Magenta / Purple
        particles: [230, 160, 255]
      },
      speaking: {
        core: [0, 230, 255],        // Radiant Sky / Amber-Cyan
        outer: [70, 130, 255],      // Cobalt
        particles: [200, 245, 255]
      }
    };

    // Particles system
    this.particles = [];
    this.numParticles = 75;
    this.angle = 0;
    this.time = 0;

    // Audio reactive data
    this.analyser = null;
    this.audioData = new Uint8Array(64);
    this.audioLevel = 0;

    // Resize handling
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Init particles
    this.initParticles();

    // Start animation loop
    this.render = this.render.bind(this);
    requestAnimationFrame(this.render);
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.centerX = this.width / 2;
    this.centerY = this.height / 2;
    this.baseRadius = Math.min(this.width, this.height) * 0.16;
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < this.numParticles; i++) {
      this.particles.push({
        angle: Math.random() * Math.PI * 2,
        distance: Math.random() * 80 + 30,
        speed: (Math.random() * 0.02 + 0.005) * (Math.random() > 0.5 ? 1 : -1),
        radius: Math.random() * 2.5 + 1,
        alpha: Math.random() * 0.7 + 0.3,
        orbitRadius: Math.random() * 70 + 20
      });
    }
  }

  setAudioAnalyser(analyser) {
    this.analyser = analyser;
    if (this.analyser) {
      this.audioData = new Uint8Array(this.analyser.frequencyBinCount);
    }
  }

  setState(newState) {
    if (['idle', 'listening', 'thinking', 'speaking'].includes(newState)) {
      this.targetState = newState;
      this.state = newState;
    }
  }

  getState() {
    return this.state;
  }

  updateAudioLevel() {
    if (this.analyser && (this.state === 'listening' || this.state === 'speaking')) {
      this.analyser.getByteFrequencyData(this.audioData);
      let sum = 0;
      const range = Math.min(32, this.audioData.length);
      for (let i = 0; i < range; i++) {
        sum += this.audioData[i];
      }
      const avg = sum / range;
      const targetLevel = avg / 255;
      this.audioLevel += (targetLevel - this.audioLevel) * 0.25;
    } else if (this.state === 'speaking') {
      // Procedural synthetic modulation if analyser not attached to TTS
      const synthetic = (Math.sin(this.time * 12) * 0.5 + 0.5) * 0.6 + (Math.sin(this.time * 24) * 0.2);
      this.audioLevel += (synthetic - this.audioLevel) * 0.2;
    } else {
      this.audioLevel *= 0.9;
    }
  }

  updateStateBlending() {
    const blendRate = 0.08;
    for (const s of ['idle', 'listening', 'thinking', 'speaking']) {
      const target = s === this.targetState ? 1 : 0;
      this.stateBlend[s] += (target - this.stateBlend[s]) * blendRate;
    }
  }

  render() {
    this.time += 0.02;
    this.updateAudioLevel();
    this.updateStateBlending();

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Deep background glow
    this.drawBackgroundGlow();

    // Rotating orbital waveform rings
    this.drawWaveformRings();

    // Core pulsing orb
    this.drawCoreOrb();

    // Swirling ethereal particles
    this.drawParticles();

    requestAnimationFrame(this.render);
  }

  drawBackgroundGlow() {
    const ctx = this.ctx;
    const r = this.baseRadius * 3.2;

    // Blend outer colors
    let cr = 0, cg = 0, cb = 0;
    for (const [stateKey, weight] of Object.entries(this.stateBlend)) {
      const col = this.palettes[stateKey].outer;
      cr += col[0] * weight;
      cg += col[1] * weight;
      cb += col[2] * weight;
    }

    const grad = ctx.createRadialGradient(
      this.centerX, this.centerY, 0,
      this.centerX, this.centerY, r
    );
    grad.addColorStop(0, `rgba(${Math.round(cr)}, ${Math.round(cg)}, ${Math.round(cb)}, 0.18)`);
    grad.addColorStop(0.5, `rgba(${Math.round(cr)}, ${Math.round(cg)}, ${Math.round(cb)}, 0.05)`);
    grad.addColorStop(1, 'rgba(2, 2, 5, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, r, 0, Math.PI * 2);
    ctx.fill();
  }

  drawCoreOrb() {
    const ctx = this.ctx;
    const breathe = Math.sin(this.time * 2.5) * 6;
    const audioReactive = this.audioLevel * 30;
    const currentRadius = Math.max(30, this.baseRadius + breathe + audioReactive);

    // Blend core colors
    let cr = 0, cg = 0, cb = 0;
    let or = 0, og = 0, ob = 0;
    for (const [stateKey, weight] of Object.entries(this.stateBlend)) {
      const c = this.palettes[stateKey].core;
      const o = this.palettes[stateKey].outer;
      cr += c[0] * weight; cg += c[1] * weight; cb += c[2] * weight;
      or += o[0] * weight; og += o[1] * weight; ob += o[2] * weight;
    }

    // Outer aura
    const auraGrad = ctx.createRadialGradient(
      this.centerX, this.centerY, currentRadius * 0.6,
      this.centerX, this.centerY, currentRadius * 1.8
    );
    auraGrad.addColorStop(0, `rgba(${Math.round(cr)}, ${Math.round(cg)}, ${Math.round(cb)}, 0.8)`);
    auraGrad.addColorStop(0.5, `rgba(${Math.round(or)}, ${Math.round(og)}, ${Math.round(ob)}, 0.35)`);
    auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, currentRadius * 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Solid core
    const coreGrad = ctx.createRadialGradient(
      this.centerX - currentRadius * 0.25,
      this.centerY - currentRadius * 0.25,
      0,
      this.centerX, this.centerY, currentRadius
    );
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.3, `rgba(${Math.round(cr)}, ${Math.round(cg)}, ${Math.round(cb)}, 0.95)`);
    coreGrad.addColorStop(0.85, `rgba(${Math.round(or)}, ${Math.round(og)}, ${Math.round(ob)}, 0.8)`);
    coreGrad.addColorStop(1, `rgba(${Math.round(or * 0.5)}, ${Math.round(og * 0.5)}, ${Math.round(ob * 0.5)}, 0.2)`);

    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, currentRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  drawWaveformRings() {
    const ctx = this.ctx;
    const numRings = 3;
    const speedMult = this.state === 'thinking' ? 4.5 : (this.state === 'listening' ? 2.5 : 1);

    for (let r = 0; r < numRings; r++) {
      ctx.save();
      ctx.translate(this.centerX, this.centerY);
      const ringAngle = (this.time * 0.5 * (r % 2 === 0 ? 1 : -1) * speedMult) + (r * Math.PI / 3);
      ctx.rotate(ringAngle);

      const ringRadius = this.baseRadius * (1.25 + r * 0.32);
      ctx.beginPath();

      const numPoints = 64;
      for (let i = 0; i <= numPoints; i++) {
        const theta = (i / numPoints) * Math.PI * 2;
        let wave = 0;

        if (this.state === 'listening' || this.state === 'speaking') {
          const freqIndex = (i + r * 8) % this.audioData.length;
          const val = this.audioData[freqIndex] || (this.audioLevel * 180);
          wave = (val / 255) * (18 + r * 10) * Math.sin(theta * 6 + this.time * 8);
        } else if (this.state === 'thinking') {
          wave = Math.sin(theta * 8 + this.time * 12) * 12;
        } else {
          wave = Math.sin(theta * 4 + this.time * 3 + r) * 5;
        }

        const rad = ringRadius + wave;
        const px = Math.cos(theta) * rad;
        const py = Math.sin(theta) * rad;

        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }

      ctx.closePath();
      const alpha = 0.25 - r * 0.06 + this.audioLevel * 0.3;
      ctx.strokeStyle = `rgba(0, 230, 255, ${Math.max(0.1, Math.min(0.85, alpha))})`;
      ctx.lineWidth = 1.8 + (r === 0 ? 1 : 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawParticles() {
    const ctx = this.ctx;
    const speedFactor = this.state === 'thinking' ? 3.5 : (this.state === 'listening' ? 1.8 : 1);

    let pr = 0, pg = 0, pb = 0;
    for (const [stateKey, weight] of Object.entries(this.stateBlend)) {
      const p = this.palettes[stateKey].particles;
      pr += p[0] * weight; pg += p[1] * weight; pb += p[2] * weight;
    }

    for (const p of this.particles) {
      p.angle += p.speed * speedFactor;
      const currentOrbit = this.baseRadius + p.orbitRadius + Math.sin(this.time * 3 + p.distance) * 10;
      const x = this.centerX + Math.cos(p.angle) * currentOrbit;
      const y = this.centerY + Math.sin(p.angle) * currentOrbit;

      ctx.fillStyle = `rgba(${Math.round(pr)}, ${Math.round(pg)}, ${Math.round(pb)}, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

window.OrbVisualizer = OrbVisualizer;
