/**
 * Web Audio Walkie-Talkie Synthesizer and Audio Effects Processor
 */

let audioCtx: AudioContext | null = null;

export function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play standard Motorola / Thuraya Next-Gen Talk Permit Tone (TPT)
 * A clean dual-tone or rapid succession chirp.
 */
export function playTalkPermitTone() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Rapid triple military beep
    const freqs = [840, 840, 840];
    const durations = [0.06, 0.06, 0.06];
    const gaps = [0.01, 0.01, 0.01];
    
    let time = now;
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, time);
      
      gainNode.gain.setValueAtTime(0, time);
      gainNode.gain.setValueAtTime(0.08, time + 0.002);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, time + durations[idx]);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(time);
      osc.stop(time + durations[idx]);
      
      time += durations[idx] + gaps[idx];
    });
  } catch (err) {
    console.error("Failed to play Talk Permit Tone", err);
  }
}

/**
 * Play authentic static Squelch Tail (the noise when release PTT)
 * Simulates radio squelch gate closing.
 */
export function playSquelchTail() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const duration = 0.25; // seconds
    
    // Create white noise buffer
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noiseNode = ctx.createBufferSource();
    noiseNode.buffer = buffer;
    
    // Create custom bandpass filter to shape white noise static
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1200;
    filter.Q.value = 1.0;
    
    // Create a smooth volume envelope (starts loud, drops off, then cuts off sharply)
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.12, now);
    gainNode.gain.setTargetAtTime(0.08, now + 0.05, 0.05);
    gainNode.gain.setValueAtTime(0.08, now + 0.18);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    
    noiseNode.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    noiseNode.start(now);
    noiseNode.stop(now + duration);
    
    // Also play an underlying sub-audible low beep click
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = "sine";
    clickOsc.frequency.setValueAtTime(140, now);
    clickGain.gain.setValueAtTime(0.15, now);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    
    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.06);
    
  } catch (err) {
    console.error("Failed to play Squelch Tail", err);
  }
}

/**
 * Play static click for rotatory knobs or keys
 */
export function playKeyClick() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.02);
    
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.022);
  } catch (err) {}
}

/**
 * Generates an audio distortion curve for a dynamic WaveshaperNode
 */
function makeDistortionCurve(amount: number) {
  const k = typeof amount === 'number' ? amount : 50;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0 ; i < n_samples; ++i ) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

/**
 * Creates audio nodes to play back a base64 audio string with customizable high-end radio filter!
 * Dynamic distortion and back-ground static levels scale with current satellite linkStrength.
 */
export async function playRadioMessage(base64Audio: string, linkStrength: number = 100) {
  try {
    const ctx = getAudioContext();
    const binary = atob(base64Audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
       bytes[i] = binary.charCodeAt(i);
    }
    
    // Decode base64 bytes to PCM AudioBuffer
    const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
    
    const sourceNode = ctx.createBufferSource();
    sourceNode.buffer = audioBuffer;
    
    // 1. Radio Lowpass Filter: Standard communications are filtered to 3200Hz
    const lpFilter = ctx.createBiquadFilter();
    lpFilter.type = "lowpass";
    lpFilter.frequency.setValueAtTime(3200, ctx.currentTime);
    
    // 2. Radio Highpass Filter: Standard communications cut off under 350Hz to remove bass and rumble
    const hpFilter = ctx.createBiquadFilter();
    hpFilter.type = "highpass";
    hpFilter.frequency.setValueAtTime(350, ctx.currentTime);
    
    // 3. Dynamic WaveShaper distortion node matching link strength!
    // Lower link strength = higher wave distortion factor!
    const distortionNode = ctx.createWaveShaper();
    const distortionAmount = Math.max(10, Math.min(180, (100 - linkStrength) * 1.8));
    distortionNode.curve = makeDistortionCurve(distortionAmount);
    distortionNode.oversample = "4x";
    
    // 4. Subtle audio compressor for walkie-talkie dynamic peak squashing
    const compressionNode = ctx.createDynamicsCompressor();
    compressionNode.threshold.setValueAtTime(-24, ctx.currentTime);
    compressionNode.knee.setValueAtTime(30, ctx.currentTime);
    compressionNode.ratio.setValueAtTime(12, ctx.currentTime);
    compressionNode.attack.setValueAtTime(0.003, ctx.currentTime);
    compressionNode.release.setValueAtTime(0.08, ctx.currentTime);

    // 5. Injected white noise static to mimic fuzzy reception for degraded channels relative to linkStrength (<90)
    let dynamicStaticBufferSource: AudioBufferSourceNode | null = null;
    let dynamicStaticGain: GainNode | null = null;
    
    if (linkStrength < 90) {
      const noiseDuration = audioBuffer.duration;
      const staticBufSize = ctx.sampleRate * noiseDuration;
      const staticBuf = ctx.createBuffer(1, staticBufSize, ctx.sampleRate);
      const staticData = staticBuf.getChannelData(0);
      for (let i = 0; i < staticBufSize; i++) {
        staticData[i] = Math.random() * 2 - 1;
      }
      
      dynamicStaticBufferSource = ctx.createBufferSource();
      dynamicStaticBufferSource.buffer = staticBuf;
      
      const staticFilter = ctx.createBiquadFilter();
      staticFilter.type = "bandpass";
      staticFilter.frequency.setValueAtTime(1000, ctx.currentTime);
      staticFilter.Q.setValueAtTime(0.8, ctx.currentTime);
      
      dynamicStaticGain = ctx.createGain();
      // Scale noise volume up if link strength drops low
      const staticIntensity = Math.min(0.06, (100 - linkStrength) * 0.0008);
      dynamicStaticGain.gain.setValueAtTime(staticIntensity, ctx.currentTime);
      
      dynamicStaticBufferSource.connect(staticFilter);
      staticFilter.connect(dynamicStaticGain);
      dynamicStaticGain.connect(ctx.destination);
    }
    
    const gainStage = ctx.createGain();
    const finalVolumeScaler = linkStrength < 40 ? 0.75 : 1.15; // lower volume if coherence is low
    gainStage.gain.setValueAtTime(finalVolumeScaler, ctx.currentTime); 
    
    // Connect pipeline
    sourceNode.connect(hpFilter);
    hpFilter.connect(lpFilter);
    lpFilter.connect(distortionNode);
    distortionNode.connect(gainStage);
    gainStage.connect(compressionNode);
    compressionNode.connect(ctx.destination);
    
    sourceNode.start(0);
    if (dynamicStaticBufferSource) {
      dynamicStaticBufferSource.start(0);
    }
    
    // Play squelch tail automatically after the incoming transmission closes!
    sourceNode.onended = () => {
      try {
        if (dynamicStaticBufferSource) {
          dynamicStaticBufferSource.stop();
          dynamicStaticBufferSource.disconnect();
        }
        if (dynamicStaticGain) {
          dynamicStaticGain.disconnect();
        }
      } catch (e) {}
      
      setTimeout(() => {
        playSquelchTail();
      }, 100);
    };
    
    return sourceNode;
  } catch (err) {
    console.error("Failed to decode and play satellite transmission:", err);
    return null;
  }
}

// Global references for continuous background atmospheric noise
let staticSource: AudioBufferSourceNode | null = null;
let staticGainNode: GainNode | null = null;

/**
 * Starts continuous looping white static noise, mimicking walkie-talkies
 * when the squelch gate threshold is opened (low dBs)
 */
export function startRadioStatic() {
  try {
    const ctx = getAudioContext();
    if (staticSource) return; // Already running

    const bufferSize = ctx.sampleRate * 2; // 2 seconds loops
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    staticSource = ctx.createBufferSource();
    staticSource.buffer = buffer;
    staticSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1000;
    filter.Q.value = 0.8;

    staticGainNode = ctx.createGain();
    staticGainNode.gain.setValueAtTime(0, ctx.currentTime); // start silent

    staticSource.connect(filter);
    filter.connect(staticGainNode);
    staticGainNode.connect(ctx.destination);

    staticSource.start(0);
  } catch (e) {
    console.warn("Could not start continuous static:", e);
  }
}

/**
 * Updates static volume dynamically. When squelch is lower, static is louder.
 */
export function updateRadioStatic(squelchLevel: number, volume: number, powerOn: boolean) {
  try {
    if (!powerOn) {
      if (staticGainNode) {
        staticGainNode.gain.setTargetAtTime(0, getAudioContext().currentTime, 0.05);
      }
      return;
    }

    // Initialize static if not created
    if (!staticSource) {
      startRadioStatic();
    }

    const ctx = getAudioContext();
    if (staticGainNode) {
      // Squelch level normally ranges from 1 to 15. Real static is loud when squelch threshold is low.
      // Squelch 0/1 = completely open gate (loud static). Squelch > 8 = closed gate (silent static).
      let targetStaticVolume = 0;
      if (squelchLevel === 0) {
        targetStaticVolume = 0.07; // Heavy static
      } else if (squelchLevel === 1) {
        targetStaticVolume = 0.025; // Moderate static
      } else if (squelchLevel === 2) {
        targetStaticVolume = 0.008; // Very faint static
      } else {
        targetStaticVolume = 0; // Squelch Gate closed (Complete silence under normal idle)
      }

      // Apply master volume scaler
      const finalVolume = targetStaticVolume * (volume / 100);
      staticGainNode.gain.setTargetAtTime(finalVolume, ctx.currentTime, 0.08);
    }
  } catch (e) {
    console.warn("Could not update static volume:", e);
  }
}

/**
 * Play a high-speed frequency hopping or scanning chirp sound
 */
export function playScanBeep() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.04);
    
    gain.gain.setValueAtTime(0.015, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  } catch (e) {}
}

/**
 * Stops static noise source
 */
export function stopRadioStatic() {
  try {
    if (staticSource) {
      staticSource.stop();
      staticSource.disconnect();
      staticSource = null;
    }
    if (staticGainNode) {
      staticGainNode.disconnect();
      staticGainNode = null;
    }
  } catch (e) {}
}

/**
 * Generates an authentic military transponder calibration check sweep or beep
 */
export function playCalibrationTone(frequency: number, duration: number) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, now);

    // Filter to simulate speaker chassis
    const lpFilter = ctx.createBiquadFilter();
    lpFilter.type = "bandpass";
    lpFilter.frequency.value = frequency;

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.08, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(lpFilter);
    lpFilter.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.05);
  } catch (e) {
    console.warn("Failed to play calibration tone:", e);
  }
}

/**
 * Formats a raw text message to follow crisp, military radio protocol in French.
 */
export function formatToMilitaryStyle(text: string): string {
  if (!text) return "";
  
  // Strip common system headers to keep it concise and focused
  let formatted = text
    .replace(/\[RECV FROM [^\]]+\]/gi, "")
    .replace(/\[🚨 EMERGENCY SOS\]/gi, "Alerte détresse S.O.S.")
    .replace(/\[SYSTEM BROADCAST[^\]]*\]/gi, "")
    .replace(/\[COM-INFO\]/gi, "Information réseau.")
    .replace(/\[MOTO-SAT GW\]/gi, "Passerelle.")
    .trim();

  // Shorten any bracketed metadata
  formatted = formatted.replace(/\[[^\]]+\]/g, "");

  // Phonetics replacements and crisp wording for french military feel
  formatted = formatted
    .replace(/\bSOS\b/gi, "S. O. S.")
    .replace(/\bWebRTC\b/gi, "Web R. T. C.")
    .replace(/\bARI\b/gi, "A. R. I.")
    .replace(/\bPTT\b/gi, "P. T. T. alternat")
    .replace(/\bIMU\b/gi, "unité de mesure inertielle")
    .replace(/\bLNB\b/gi, "L. N. B.")
    .replace(/\bE2E\b/gi, "bout-en-bout")
    .replace(/\bAES-256\b/gi, "A. E. S. deux-cent-cinquante-six")
    .replace(/\bOPERATOR\b/gi, "opérateur")
    .replace(/\bSAT-STATION\b/gi, "relais satellite")
    .replace(/\bSYSTEM\b/gi, "contrôle central")
    .replace(/\bThuraya\b/gi, "Touraya")
    .replace(/\bover\b/gi, "à vous")
    .replace(/\bout\b/gi, "terminé")
    .replace(/\broger\b/gi, "bien reçu")
    .replace(/\bcopy\b/gi, "reçu cinq sur cinq")
    .replace(/\bGPS\b/gi, "G. P. S.");

  // Keep it highly concise
  if (formatted.length > 160) {
    formatted = formatted.slice(0, 150) + "... message abrégé. À vous.";
  }

  // Ensure standard military French trailing keyword if not present
  if (!formatted.toLowerCase().includes("à vous") && !formatted.toLowerCase().includes("terminé")) {
    formatted += ". À vous.";
  }

  return formatted;
}

/**
 * Speaks the provided text in an authentic, high-speed, crisp French military radio operator voice.
 * Cancels current speaking voice to avoid queue overlaps.
 */
export function playMilitaryRadioTTS(text: string) {
  try {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    // Concurrently cancel any ongoing speech to avoid delayed playback backlog
    window.speechSynthesis.cancel();

    const formattedText = formatToMilitaryStyle(text);
    if (!formattedText) return;

    // 1. Play starting squelch entry beep (Talk Permit Tone)
    playTalkPermitTone();

    // Short timeout to let the beep initiate before speech starts
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(formattedText);
      
      // Select best French voice if available, otherwise fallback
      const voices = window.speechSynthesis.getVoices();
      const frVoice = voices.find(v => v.lang.startsWith("fr") || v.lang.includes("FR"));
      if (frVoice) {
        utterance.voice = frVoice;
      }
      
      utterance.lang = "fr-FR";
      utterance.rate = 1.08;  // Fast, crisp comm pace
      utterance.pitch = 0.90; // Authoritative lower frequency

      utterance.onend = () => {
        // Play final Squelch static closure click
        playSquelchTail();
      };

      utterance.onerror = (e) => {
        console.warn("Speech synthesis error inside military TTS engine:", e);
      };

      window.speechSynthesis.speak(utterance);
    }, 120);

  } catch (err) {
    console.error("Military radio TTS failed to execute:", err);
  }
}


