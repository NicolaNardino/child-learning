/* The Stunt Wheels soundtrack: an original, hypnotic synth loop made live with Web Audio (no sound files).
   126 beats a minute, four bars round and round (A minor, A minor, F, G): a four-on-the-floor kick, off-beat
   hats and claps, a pumping bass, a bouncing arpeggio through an echo, and a soft pad, with a filter that
   slowly opens and closes over 16 bars so it keeps pulling you along. Plus the engine hum.
     const m = WheelsMusic()   m.start(), m.stop(), m.engine(speed 0..1, on)   (start only after a tap or key)
   Race Off also uses: m.wake() (sound without the music), m.engine(speed, on, voice, throttle) with a voice per
   car, m.loop(name, volume) for steady noises (squeal, rain, boost) and m.sting() for a crash. */
(function(){
  "use strict";
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  const BPM = 126, STEP = 60 / BPM / 4;
  const ROOTS = [45, 45, 41, 43];                          // A, A, F, G (bass, MIDI)
  const CHORDS = [[69, 72, 76, 81], [69, 72, 76, 81], [65, 69, 72, 77], [67, 71, 74, 79]];
  const BASS = [0, 0, 12, 0, 7, 0, 12, 0, 0, 0, 12, 0, 7, 0, 10, 0];
  const ARP = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 1, 3, 2];

  // steady noises: filtered noise that fades in and out
  const LOOPS = { squeal: { type: "bandpass", f: 2900, q: 14 }, rain: { type: "highpass", f: 1500, q: 0.4 }, boost: { type: "bandpass", f: 520, q: 1.2 } };

  window.WheelsMusic = function(){
    const loops = {};
    let ac = null, master = null, sweep = null, timer = 0, next = 0, step = 0, noise = null, eng = null;
    function setup(){
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ac = new AC();
      const comp = ac.createDynamicsCompressor();
      master = ac.createGain(); master.gain.value = 0.55;
      sweep = ac.createBiquadFilter(); sweep.type = "lowpass"; sweep.frequency.value = 2400; sweep.Q.value = 4;
      master.connect(comp); comp.connect(ac.destination);
      const n = ac.sampleRate, buf = ac.createBuffer(1, n, n), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      noise = buf;
      // the echo the arpeggio goes through: three steps late, fading
      const delay = ac.createDelay(1); delay.delayTime.value = STEP * 3;
      const fb = ac.createGain(); fb.gain.value = 0.38;
      sweep.connect(master); sweep.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(master);
      return true;
    }
    function tone(type, freq, t, dur, vol, dest, attack){
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (attack || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + 0.02);
      return o;
    }
    function hiss(t, dur, vol, type, freq){
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noise; f.type = type; f.frequency.value = freq;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur);
    }
    function kick(t){
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.32);
    }
    function schedule(){
      while (next < ac.currentTime + 0.15) {
        const t = next, s = step % 16, bar = Math.floor(step / 16) % 4, root = ROOTS[bar], chord = CHORDS[bar];
        if (s % 4 === 0) kick(t);
        if (s % 4 === 2) hiss(t, 0.05, 0.12, "highpass", 7500);
        if (s === 4 || s === 12) hiss(t, 0.16, 0.22, "bandpass", 1600);
        if (s % 2 === 1) hiss(t, 0.025, 0.04, "highpass", 9000);
        // the bass, ducking under the kick for that pumping feel
        const bf = ac.createBiquadFilter(); bf.type = "lowpass"; bf.frequency.value = 520; bf.connect(master);
        tone("sawtooth", midi(root + BASS[s] - 12), t + (s % 4 === 0 ? 0.03 : 0), STEP * 0.9, s % 4 === 0 ? 0.16 : 0.24, bf);
        // the arpeggio into the slowly sweeping filter
        tone("square", midi(chord[ARP[s]]), t, STEP * 0.8, 0.05, sweep);
        // a soft pad on the first step of each bar
        if (s === 0) chord.slice(0, 3).forEach(n => { tone("sawtooth", midi(n - 12) * 1.003, t, STEP * 15, 0.022, sweep, 0.4); tone("sawtooth", midi(n - 12) * 0.997, t, STEP * 15, 0.022, sweep, 0.4); });
        // over 16 bars the filter opens wide and closes again
        const phase = (step % 256) / 256;
        sweep.frequency.setValueAtTime(700 + 4800 * (0.5 - 0.5 * Math.cos(phase * Math.PI * 2)), t);
        next += STEP; step++;
      }
    }
    return {
      start(){
        if (!ac && !setup()) return;
        if (ac.state === "suspended") ac.resume();
        if (timer) return;
        next = ac.currentTime + 0.08;
        timer = setInterval(schedule, 25);
      },
      stop(){
        if (timer) { clearInterval(timer); timer = 0; }
        if (eng) { eng.g.gain.setTargetAtTime(0, ac.currentTime, 0.05); }
        Object.keys(loops).forEach(k => loops[k].setTargetAtTime(0, ac.currentTime, 0.05));
      },
      // the music stays off, but the engine and the noises can play
      wake(){
        if (!ac && !setup()) return false;
        if (ac.state === "suspended") ac.resume();
        return true;
      },
      loop(name, vol){
        if (!ac || !LOOPS[name]) return;
        if (!loops[name]) {
          const c = LOOPS[name], src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
          src.buffer = noise; src.loop = true; f.type = c.type; f.frequency.value = c.f; f.Q.value = c.q; g.gain.value = 0;
          src.connect(f); f.connect(g); g.connect(ac.destination); src.start();
          loops[name] = g.gain;
        }
        loops[name].setTargetAtTime(vol, ac.currentTime, 0.06);
      },
      // a crash: a falling growl and a crunch
      sting(){
        if (!ac) return;
        const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
        o.type = "sawtooth"; o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.7);
        g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
        o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.8);
        const src = ac.createBufferSource(), f = ac.createBiquadFilter(), ng = ac.createGain();
        src.buffer = noise; f.type = "lowpass"; f.frequency.value = 900; ng.gain.setValueAtTime(0.5, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        src.connect(f); f.connect(ng); ng.connect(ac.destination); src.start(t); src.stop(t + 0.5);
      },
      // the engine: a low growl that rises with speed
      // voice: { base, span, type } (Hz at rest, Hz added at top speed, wave); throttle 0..1 revs it up
      engine(speed, on, voice, throttle){
        if (!ac) return;
        const v = voice || { base: 48, span: 140, type: "sawtooth" }, th = throttle || 0;
        if (!eng) {
          const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
          o.type = "sawtooth"; f.type = "lowpass"; f.frequency.value = 600; g.gain.value = 0;
          o.connect(f); f.connect(g); g.connect(ac.destination); o.start();
          eng = { o, f, g };
        }
        if (eng.o.type !== v.type) eng.o.type = v.type;
        const t = ac.currentTime;
        eng.o.frequency.setTargetAtTime((v.base + speed * v.span) * (1 + 0.14 * th), t, 0.08);
        eng.f.frequency.setTargetAtTime(380 + speed * 900 + th * 300, t, 0.1);
        eng.g.gain.setTargetAtTime(on ? 0.035 + speed * 0.03 + th * 0.012 : 0, t, 0.08);
      }
    };
  };
})();
