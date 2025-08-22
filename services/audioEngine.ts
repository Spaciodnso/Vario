
export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private mainGain: GainNode | null = null;
  private oscillator: OscillatorNode | null = null;
  private muted = false;
  private lastUpdateTime = 0;
  private liftThreshold = 0.2;
  private sinkThreshold = -2.0;
  private actionPending = false; // For debouncing proximity sensor

  constructor() {
    // Initialization will be done on first user interaction
  }
  
  public isActionPending(): boolean {
    return this.actionPending;
  }

  public setActionPending(pending: boolean) {
    this.actionPending = pending;
  }
  
  public start() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.mainGain = this.audioContext.createGain();
      this.mainGain.connect(this.audioContext.destination);
      this.setMuted(this.muted);
    }
    // Resume context if it was suspended
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  public stop() {
    if (this.oscillator) {
      this.oscillator.stop();
      this.oscillator = null;
    }
    if (this.audioContext && this.audioContext.state === 'running') {
      this.audioContext.suspend();
    }
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.mainGain) {
      this.mainGain.gain.setValueAtTime(muted ? 0 : 0.5, this.audioContext?.currentTime || 0);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public update(verticalSpeed: number) {
    if (!this.audioContext || !this.mainGain || this.muted) return;

    const now = this.audioContext.currentTime;
    
    // --- Sink Tone ---
    if (verticalSpeed < this.sinkThreshold) {
      if (!this.oscillator) {
        this.oscillator = this.audioContext.createOscillator();
        this.oscillator.connect(this.mainGain);
        this.oscillator.start();
      }
      const freq = 300 + (verticalSpeed * 20); // Deeper as sink increases
      this.oscillator.type = 'sawtooth';
      this.oscillator.frequency.setTargetAtTime(Math.max(150, freq), now, 0.05);
      return;
    }

    // --- Lift Tone ---
    if (verticalSpeed > this.liftThreshold) {
      const pitch = 500 + (verticalSpeed * 150);
      const frequency = 1 + (verticalSpeed * 2); // Beeps per second
      const beepDuration = 0.1;

      if (now > this.lastUpdateTime + (1 / frequency)) {
        this.lastUpdateTime = now;
        
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.connect(gain);
        gain.connect(this.mainGain);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(pitch, now);
        gain.gain.setValueAtTime(1, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + beepDuration);
        
        osc.start(now);
        osc.stop(now + beepDuration);
      }
      
      // Stop continuous tone if it was running
      if (this.oscillator) {
          this.oscillator.stop();
          this.oscillator = null;
      }
      return;
    }

    // Silence or near-zero "lifty air" sound
    if (this.oscillator) {
      this.oscillator.stop();
      this.oscillator = null;
    }

    // Optional: Add "lifty air" ticking sound here
    // if (verticalSpeed > 0.1 && verticalSpeed <= this.liftThreshold) { ... }
  }
}
