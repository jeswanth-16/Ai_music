/**
 * Techi Telemetry Mini-Agents (Battery, Motor, Driver Wellness)
 * Provides dummy data placeholders, connectable to real hardware via techi.updateData()
 */

class BatteryAgent {
  constructor() {
    this.data = {
      percentage: 78,
      rangeKm: 240,
      temperature: 34, // Celsius
      status: 'Discharging',
      health: 98
    };
  }

  update(newData) {
    this.data = { ...this.data, ...newData };
    console.log('[BatteryAgent] Data updated:', this.data);
  }

  getStatus() {
    return {
      ...this.data,
      summary: `Battery is at ${this.data.percentage} percent with an estimated range of ${this.data.rangeKm} kilometers. Temperature is ${this.data.temperature} degrees.`
    };
  }
}

class MotorAgent {
  constructor() {
    this.data = {
      mode: 'Eco',
      speedKmh: 45,
      torqueNm: 135,
      rpm: 2900,
      temperature: 42,
      efficiency: 94
    };
  }

  update(newData) {
    this.data = { ...this.data, ...newData };
    console.log('[MotorAgent] Data updated:', this.data);
  }

  getStatus() {
    return {
      ...this.data,
      summary: `Motor is running in ${this.data.mode} mode at ${this.data.speedKmh} km/h, with temperature at ${this.data.temperature} degrees.`
    };
  }
}

class DriverWellnessAgent {
  constructor(speaker, musicAgent) {
    this.speaker = speaker;
    this.musicAgent = musicAgent;
    this.data = {
      alertness: 'Alert',
      heartRate: 72,
      drivingDurationMins: 45,
      fatigueRisk: 'Low'
    };
  }

  update(newData) {
    this.data = { ...this.data, ...newData };
    console.log('[DriverWellnessAgent] Data updated:', this.data);

    // If driver is drowsy or fatigued, trigger wellness response
    if (this.data.alertness === 'Drowsy' || this.data.fatigueRisk === 'High') {
      if (this.speaker) {
        this.speaker.speak("Alert boss! Drowsiness detect aagirukku. Please take a break or let me play energetic songs.");
      }
      if (this.musicAgent) {
        this.musicAgent.playMoodMusic('drowsy');
      }
    }
  }

  getStatus() {
    return {
      ...this.data,
      summary: `Driver status is ${this.data.alertness}, heart rate is ${this.data.heartRate} bpm, driving for ${this.data.drivingDurationMins} minutes.`
    };
  }
}

window.BatteryAgent = BatteryAgent;
window.MotorAgent = MotorAgent;
window.DriverWellnessAgent = DriverWellnessAgent;
