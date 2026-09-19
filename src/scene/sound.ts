export class ToySound {
  context: AudioContext | null = null;
  enabled = false;
  last = 0;
  play(kind: "place" | "gate" | "finish" | "impact") {
    if (!this.enabled) return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === "suspended") void this.context.resume();
      const now = this.context.currentTime;
      if (kind === "impact" && now - this.last < 0.12) return;
      this.last = now;
      const tones =
        kind === "finish"
          ? [660, 830, 990]
          : kind === "place"
            ? [460]
            : kind === "gate"
              ? [240, 320]
              : [180];
      tones.forEach((f, i) => {
        const o = this.context!.createOscillator(),
          g = this.context!.createGain(),
          t = now + i * 0.085;
        o.type = kind === "impact" ? "sine" : "triangle";
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.1);
        g.gain.setValueAtTime(kind === "impact" ? 0.014 : 0.035, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        o.connect(g);
        g.connect(this.context!.destination);
        o.start(t);
        o.stop(t + 0.2);
      });
    } catch {
      /* Audio is optional. */
    }
  }
  dispose() {
    void this.context?.close();
  }
}
