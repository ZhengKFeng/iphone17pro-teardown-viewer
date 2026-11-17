import type { CSSProperties } from 'react';
import { Playback } from '../state/playback';
import { useStore } from '../state/store';
import { PauseIcon, PlayIcon, ResetIcon, ReverseIcon } from './icons';

const SPEEDS = [0.25, 0.5, 1, 2, 4];

function stageName(t: number): string {
  if (t <= 0.001) return 'Assembled';
  if (t < 0.3) return 'Opening: display and rear covers lift';
  if (t < 0.65) return 'Separating internal layers';
  if (t < 0.999) return 'Spreading components';
  return 'Fully exploded';
}

export function ExplosionControls() {
  const t = useStore((s) => s.explosion);
  const playing = useStore((s) => s.playing);
  const speed = useStore((s) => s.speed);
  const pct = Math.round(t * 1000) / 10;

  return (
    <div className="panel pointer-events-auto w-full max-w-3xl px-3 py-2.5 sm:px-4" data-testid="explosion-controls">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="section-title">Explosion</span>
        <span className="truncate text-[11px] text-neutral-400" data-testid="stage-name">
          {stageName(t)}
        </span>
        <span className="font-mono text-xs tabular-nums text-ember-300" data-testid="explosion-readout">
          {pct.toFixed(1)}%
        </span>
      </div>
      <input
        aria-label="Explosion progress"
        data-testid="explosion-slider"
        className="slider w-full"
        style={{ '--fill': `${pct}%` } as CSSProperties}
        type="range"
        min={0}
        max={1}
        step={0.001}
        value={t}
        onChange={(e) => Playback.scrub(parseFloat(e.target.value))}
      />
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <button className="btn" title="Reassemble (play in reverse)" data-testid="btn-reverse" disabled={t <= 0} onClick={() => (playing === 'reverse' ? Playback.pause() : Playback.reverse())}>
          {playing === 'reverse' ? <PauseIcon /> : <ReverseIcon />}
          <span className="hidden sm:inline">Reassemble</span>
        </button>
        <button className="btn btn-primary" title="Play / pause automated teardown (Space)" data-testid="btn-play" onClick={() => (playing === 'forward' ? Playback.pause() : Playback.play())}>
          {playing === 'forward' ? <PauseIcon /> : <PlayIcon />}
          <span>{playing === 'forward' ? 'Pause' : 'Teardown'}</span>
        </button>
        <button className="btn" title="Reset assembly: close the phone and show all parts" data-testid="btn-reset-assembly" onClick={() => Playback.reset()}>
          <ResetIcon />
          <span className="hidden sm:inline">Reset</span>
        </button>
        <div className="ml-auto flex items-center gap-1">
          <span className="section-title mr-1 hidden sm:inline">Speed</span>
          {SPEEDS.map((s) => (
            <button key={s} className={`btn px-1.5 font-mono ${speed === s ? 'btn-active' : ''}`} data-testid={`speed-${s}`} onClick={() => Playback.setSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
