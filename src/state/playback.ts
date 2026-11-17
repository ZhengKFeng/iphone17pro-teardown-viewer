import gsap from 'gsap';
import { useStore } from './store';

/**
 * Playback: drives explosionProgress with a GSAP tween. The tween only ever
 * writes the scalar progress value; component transforms are recomputed from
 * it, so play / pause / reverse can be interleaved freely without drift.
 */

/** Seconds for a full 0 → 1 sweep at 1× speed. */
export const FULL_SWEEP_SECONDS = 7;

const proxy = { t: 0 };
let tween: gsap.core.Tween | null = null;

function kill() {
  tween?.kill();
  tween = null;
}

function run(target: 0 | 1, seconds: number, direction: 'forward' | 'reverse') {
  const store = useStore.getState();
  kill();
  proxy.t = store.explosion;
  store.setPlaying(direction);
  tween = gsap.to(proxy, {
    t: target,
    duration: Math.max(0.05, seconds),
    ease: 'sine.inOut',
    onUpdate: () => useStore.getState().setExplosion(proxy.t),
    onComplete: () => {
      tween = null;
      const s = useStore.getState();
      s.setExplosion(target); // land exactly on the end state
      s.setPlaying(null);
    },
  });
  tween.timeScale(store.speed);
}

export const Playback = {
  /** Play the teardown (assembled → exploded). Restarts if already exploded. */
  play() {
    const s = useStore.getState();
    if (s.explosion >= 1 - 1e-6) s.setExplosion(0);
    run(1, FULL_SWEEP_SECONDS * (1 - useStore.getState().explosion), 'forward');
  },

  /** Play the reassembly (current state → assembled). */
  reverse() {
    const s = useStore.getState();
    if (s.explosion <= 1e-6) return;
    run(0, FULL_SWEEP_SECONDS * s.explosion, 'reverse');
  },

  pause() {
    kill();
    useStore.getState().setPlaying(null);
  },

  toggle() {
    if (useStore.getState().playing) this.pause();
    else this.play();
  },

  /** Manual scrub from the slider. */
  scrub(t: number) {
    this.pause();
    useStore.getState().setExplosion(t);
  },

  setSpeed(speed: number) {
    useStore.getState().setSpeed(speed);
    tween?.timeScale(speed);
  },

  /** Reset assembly: quickly close the phone and show every component. */
  reset() {
    const s = useStore.getState();
    s.restoreAll();
    if (s.explosion <= 1e-6) {
      this.pause();
      s.setExplosion(0);
      return;
    }
    run(0, 0.8 * useStore.getState().speed, 'reverse'); // ~0.8 s regardless of speed
  },
};
