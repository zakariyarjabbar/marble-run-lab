import {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Workbench, type SceneEvents } from "../scene/Workbench";
import { initPhysics } from "../core/physics";
import type { Track, Piece } from "../core/model";
export interface SceneHandle {
  bench: Workbench | null;
}
export const Scene = forwardRef<
  SceneHandle,
  {
    track: Track;
    events: SceneEvents;
    selected: string | null;
    mode: "build" | "run";
    playing: boolean;
    speed: number;
    follow: number | null;
    preview: Piece | null;
    valid: boolean;
    photo: boolean;
  }
>((props, ref) => {
  const host = useRef<HTMLDivElement>(null),
    bench = useRef<Workbench | null>(null),
    latest = useRef(props);
  latest.current = props;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useImperativeHandle(
    ref,
    () => ({
      get bench() {
        return bench.current;
      },
    }),
    [],
  );
  useEffect(() => {
    let cancelled = false;
    initPhysics()
      .then(() => {
        if (cancelled || !host.current) return;
        try {
          const events = Object.fromEntries(
            Object.keys(latest.current.events).map((k) => [
              k,
              (...args: unknown[]) => {
                const fn = latest.current.events[k as keyof SceneEvents] as (
                  ...a: unknown[]
                ) => void;
                fn(...args);
              },
            ]),
          ) as unknown as SceneEvents;
          const b = new Workbench(host.current, events);
          bench.current = b;
          b.update(latest.current.track);
          b.cameraView("home");
          if (!b.reduced) {
            b.camera.position.multiplyScalar(1.12);
          }
          setReady(true);
          events.ready();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Graphics unavailable");
        }
      })
      .catch(() =>
        setError(
          "The physics engine could not load. Check your connection and reload.",
        ),
      );
    return () => {
      cancelled = true;
      bench.current?.dispose();
      bench.current = null;
    };
  }, []);
  const structural = JSON.stringify([
    props.track.pieces,
    props.track.settings.count,
    props.track.settings.appearance,
  ]);
  const oldIds = useRef<string[]>([]);
  useEffect(() => {
    if (!ready || !bench.current) return;
    const added = props.track.pieces.find(
      (p) => !oldIds.current.includes(p.id),
    );
    bench.current.update(props.track, added?.id);
    oldIds.current = props.track.pieces.map((p) => p.id);
  }, [structural, ready]);
  useEffect(() => {
    const b = bench.current;
    if (b) {
      b.track = props.track;
      b.sound.enabled = props.track.settings.sound;
      b.grid.visible = props.track.settings.grid && !props.photo;
      b.renderer.setPixelRatio(
        Math.min(
          devicePixelRatio,
          props.track.settings.quality === "low" ? 1 : 2,
        ),
      );
      b.renderer.shadowMap.enabled = props.track.settings.quality === "high";
    }
  }, [
    props.track.settings.grid,
    props.track.settings.sound,
    props.track.settings.quality,
    props.photo,
    ready,
  ]);
  useEffect(() => {
    bench.current?.select(props.selected);
  }, [props.selected, ready, structural]);
  useEffect(() => {
    bench.current?.setMode(props.mode);
  }, [props.mode, ready]);
  useEffect(() => {
    if (!bench.current) return;
    if (props.playing) bench.current.play();
    else bench.current.playing = false;
  }, [props.playing, ready, structural]);
  useEffect(() => {
    if (bench.current) bench.current.speed = props.speed;
  }, [props.speed, ready]);
  useEffect(() => {
    if (bench.current) bench.current.follow = props.follow;
  }, [props.follow, ready]);
  useEffect(() => {
    bench.current?.preview(props.preview, props.valid);
  }, [JSON.stringify(props.preview), props.valid, ready]);
  useEffect(() => {
    bench.current?.setPhoto(props.photo);
  }, [props.photo, ready]);
  return (
    <>
      <div className="scene-canvas" ref={host} />
      {!ready && !error && (
        <div className="loading-scene">
          <span className="loading-marble" />
          Setting up your workbench…
        </div>
      )}
      {error && (
        <div className="graphics-error" role="alert">
          <h2>The workbench couldn’t open.</h2>
          <p>{error}</p>
          <p>
            Use a browser with WebGL 2 and hardware acceleration enabled. Your
            saved track is preserved.
          </p>
          <button onClick={() => location.reload()}>Try again</button>
        </div>
      )}
    </>
  );
});
