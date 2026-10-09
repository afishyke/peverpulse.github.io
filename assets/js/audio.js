/** Optional, synthesized ambient bed. Starts ONLY inside a user click. */
export function createAmbient(button) {
  let context,
    gain,
    sources = [],
    on = false;
  async function toggle() {
    try {
      if (!context) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) throw new Error("Audio unavailable");
        context = new Audio();
        gain = context.createGain();
        gain.gain.value = 0;
        const filter = context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 620;
        gain.connect(filter).connect(context.destination);
        [110, 164.81, 220, 277.18].forEach((frequency, index) => {
          const oscillator = context.createOscillator();
          const level = context.createGain();
          oscillator.type = "sine";
          oscillator.frequency.value = frequency;
          oscillator.detune.value = index % 2 ? 3 : -3;
          level.gain.value = 0.08 / (index + 1);
          oscillator.connect(level).connect(gain);
          oscillator.start();
          sources.push(oscillator);
        });
      }
      await context.resume();
      on = !on;
      gain.gain.setTargetAtTime(on ? 0.65 : 0, context.currentTime, 0.6);
      button.setAttribute("aria-pressed", String(on));
      button.querySelector("span").textContent = on ? "Sound on" : "Sound off";
    } catch {
      button.querySelector("span").textContent = "Audio unavailable";
      button.disabled = true;
    }
  }
  button?.addEventListener("click", toggle);
  const visibility = () => {
    if (context) document.hidden ? context.suspend() : on && context.resume();
  };
  document.addEventListener("visibilitychange", visibility);
  return {
    update(progress) {
      if (context && on)
        sources.forEach((source, index) =>
          source.detune.setTargetAtTime(
            (index % 2 ? 3 : -3) - progress * 12,
            context.currentTime,
            1,
          ),
        );
    },
    dispose() {
      button?.removeEventListener("click", toggle);
      document.removeEventListener("visibilitychange", visibility);
      sources.forEach((source) => source.stop());
      context?.close();
    },
  };
}
