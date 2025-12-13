// Sound Manager - Web Audio API based sound effects
class SoundManager {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
        this.volume = 0.3;
        this.init();
    }

    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
            this.enabled = false;
        }
    }

    // Resume audio context (required for autoplay policies)
    resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    // Play a tone with specified parameters
    playTone(frequency, duration, type = 'sine', volumeMultiplier = 1) {
        if (!this.enabled || !this.audioContext) return;

        this.resume();

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        const now = this.audioContext.currentTime;
        const vol = this.volume * volumeMultiplier;

        // Envelope for natural sound
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(vol, now + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

        oscillator.start(now);
        oscillator.stop(now + duration);
    }

    // UI Sounds
    click() {
        this.playTone(800, 0.05, 'sine', 0.5);
    }

    hover() {
        this.playTone(600, 0.03, 'sine', 0.3);
    }

    tabSwitch() {
        const now = this.audioContext?.currentTime || 0;
        this.playTone(400, 0.08, 'sine', 0.6);
        setTimeout(() => this.playTone(600, 0.08, 'sine', 0.4), 50);
    }

    // Message Sounds
    messageSend() {
        const now = this.audioContext?.currentTime || 0;
        this.playTone(600, 0.1, 'sine', 0.7);
        setTimeout(() => this.playTone(900, 0.1, 'sine', 0.5), 80);
    }

    messageReceive() {
        this.playTone(500, 0.15, 'sine', 0.6);
        setTimeout(() => this.playTone(700, 0.12, 'sine', 0.4), 100);
    }

    typing() {
        this.playTone(300, 0.05, 'square', 0.2);
    }

    // Status Sounds
    success() {
        this.playTone(523, 0.1, 'sine', 0.6); // C
        setTimeout(() => this.playTone(659, 0.1, 'sine', 0.5), 100); // E
        setTimeout(() => this.playTone(784, 0.15, 'sine', 0.6), 200); // G
    }

    error() {
        this.playTone(200, 0.2, 'sawtooth', 0.5);
        setTimeout(() => this.playTone(150, 0.2, 'sawtooth', 0.4), 150);
    }

    warning() {
        this.playTone(400, 0.15, 'triangle', 0.5);
        setTimeout(() => this.playTone(350, 0.15, 'triangle', 0.4), 120);
    }

    // Data Operation Sounds
    refresh() {
        for (let i = 0; i < 3; i++) {
            setTimeout(() => this.playTone(400 + i * 100, 0.05, 'sine', 0.4), i * 60);
        }
    }

    upload() {
        for (let i = 0; i < 4; i++) {
            setTimeout(() => this.playTone(300 + i * 150, 0.08, 'sine', 0.5), i * 70);
        }
    }

    // AI Sounds
    aiThinking() {
        this.playTone(250, 0.3, 'triangle', 0.3);
    }

    aiComplete() {
        this.playTone(600, 0.1, 'sine', 0.6);
        setTimeout(() => this.playTone(800, 0.15, 'sine', 0.5), 100);
    }

    // Control Methods
    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
    }

    setEnabled(enabled) {
        this.enabled = enabled;
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

// Create singleton instance
const soundManager = new SoundManager();

export default soundManager;
