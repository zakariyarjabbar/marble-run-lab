import { registerWorkshopTools } from "./core/webmcp";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Undo2,
  Redo2,
  Download,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Check,
  Plus,
  Minus,
  X,
  Box,
  MoveUpRight,
  RotateCw,
  Copy,
  Trash2,
  MousePointer2,
  Layers3,
  SlidersHorizontal,
  Maximize,
  Camera,
  Focus,
  Volume2,
  VolumeX,
  HelpCircle,
  ArrowUpRight,
  Upload,
  FileJson,
  Image,
  Grid2X2,
  CheckCheck,
  Flag,
  Move,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Settings2,
  PanelLeftClose,
  PanelLeftOpen,
  Eye,
  Home,
  Pencil,
  Rabbit,
  Turtle,
  TriangleAlert,
  Expand,
} from "lucide-react";
import {
  COLORS,
  DEFINITIONS,
  attach,
  exit,
  openEnds,
  preset,
  placementError,
  moveChain,
  lengthOf,
  connected,
  downstream,
  insertPiece,
  type Track,
  type Piece,
  type PieceType,
  type ColorName,
  type Vec3,
} from "./core/model";
import { commit, history, undo, redo } from "./core/history";
import {
  loadTrack,
  saveTrack,
  parseTrack,
  serialize,
  download,
} from "./core/persistence";
import { Scene, type SceneHandle } from "./components/Scene";
import { makePreviews } from "./scene/previews";
import type { Stats, SceneEvents } from "./scene/Workbench";
function IconButton({
  label,
  children,
  onClick,
  disabled = false,
  active = false,
  className = "",
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? "active" : ""} ${className}`}
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
const PRESETS = [
  { name: "First Drop", tag: "A lovely place to start", level: "Easy" },
  { name: "The Spiral", tag: "Round, round, and away", level: "Curious" },
  { name: "Loop Theory", tag: "Put momentum to the test", level: "Bold" },
];
const initial = loadTrack();
export default function App() {
  const [hist, setHist] = useState(() => history(initial.track));
  const track = hist.present;
  const trackRef = useRef(track);
  trackRef.current = track;
  const scene = useRef<SceneHandle>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"build" | "run">("build");
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [tool, setTool] = useState<PieceType | null>(null);
  const [attachId, setAttachId] = useState<string | null>(null);
  const [rotatePreview, setRotatePreview] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [follow, setFollow] = useState<number | null>(null);
  const [stats, setStats] = useState<Stats>({
    elapsed: 0,
    finished: 0,
    fallen: 0,
    total: track.settings.count,
  });
  const [saveStatus, setSaveStatus] = useState("Saved locally");
  const [notice, setNotice] = useState(initial.error ?? "");
  const [guidance, setGuidance] = useState(true);
  const [leftOpen, setLeftOpen] = useState(true);
  const [mobileLibrary, setMobileLibrary] = useState(false);
  const [mobileSettings, setMobileSettings] = useState(false);
  const [rightOpen, setRightOpen] = useState(true);
  const [category, setCategory] = useState("All pieces");
  const [dialog, setDialog] = useState<"export" | "presets" | "help" | null>(
    null,
  );
  const [photo, setPhoto] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [importError, setImportError] = useState("");
  const [pngBusy, setPngBusy] = useState(false);
  const [topView, setTopView] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const noticeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedPiece = track.pieces.find((p) => p.id === selected);
  const ends = openEnds(track.pieces);
  const anchor =
    track.pieces.find((p) => p.id === attachId) ||
    ends.at(-1) ||
    track.pieces.find((p) => p.id === selected);
  let preview: Piece | null = null;
  if (tool && anchor && mode === "build") {
    preview = attach(anchor, tool);
    preview.id = "preview";
    preview.yaw += rotatePreview;
  }
  const displaced = anchor
    ? new Set(
        downstream(track.pieces, anchor.id)
          .slice(1)
          .map((p) => p.id),
      )
    : new Set<string>();
  const invalid = preview
    ? Math.abs(Math.sin(rotatePreview / 2)) > 0.02
      ? "Entrance directions must align. Rotate back to snap."
      : placementError(
          preview,
          track.pieces.filter((p) => !displaced.has(p.id)),
        )
    : null;
  const notify = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimeout.current) clearTimeout(noticeTimeout.current);
    noticeTimeout.current = setTimeout(() => setNotice(""), 4500);
  }, []);
  const edit = useCallback((fn: (t: Track) => Track) => {
    setHist((h) => commit(h, fn(h.present)));
  }, []);
  const settings = (change: Partial<Track["settings"]>) =>
    edit((t) => ({ ...t, settings: { ...t.settings, ...change } }));
  const reset = useCallback(() => {
    setPlaying(false);
    setFollow(null);
    scene.current?.bench?.reset();
  }, []);
  const build = useCallback(() => {
    setMode("build");
    setPlaying(false);
    setFollow(null);
    setTool(null);
  }, []);
  const play = useCallback(() => {
    if (!ready) return;
    if (!trackRef.current.pieces.some((p) => p.type === "start")) {
      notify("Add a start gate to release marbles.");
      return;
    }
    if (scene.current?.bench?.sim) {
      const s = scene.current.bench.sim.stats;
      if (s.elapsed > 0 && s.finished + s.fallen === s.total)
        scene.current.bench.reset();
    }
    setTool(null);
    setMobileSettings(false);
    setMobileLibrary(false);
    setMode("run");
    setPlaying((p) => !p);
  }, [ready, notify]);
  const doUndo = useCallback(() => {
    build();
    setHist(undo);
    setSelected(null);
  }, [build]);
  const doRedo = useCallback(() => {
    build();
    setHist(redo);
    setSelected(null);
  }, [build]);
  const remove = useCallback(() => {
    if (mode === "run" || !selected) return;
    edit((t) => ({ ...t, pieces: t.pieces.filter((p) => p.id !== selected) }));
    setSelected(null);
    notify("Piece removed. Its neighbours stay in place. Undo to restore.");
  }, [selected, mode, edit, notify]);
  const duplicate = () => {
    if (!selectedPiece || mode === "run") return;
    const p = {
      ...selectedPiece,
      id: crypto.randomUUID(),
      position: [
        selectedPiece.position[0],
        selectedPiece.position[1] + 1,
        selectedPiece.position[2] + 2,
      ] as Vec3,
    };
    if (placementError(p, track.pieces)) {
      notify("Make some room before duplicating this piece.");
      return;
    }
    edit((t) => ({ ...t, pieces: [...t.pieces, p] }));
    setSelected(p.id);
    notify("Duplicated. Move this piece using the inspector.");
  };
  const moveSelected = (delta: Vec3, turn = 0) => {
    if (!selected || mode === "run") return;
    const adjusted = delta.map((v, i) =>
      i !== 1 && !track.settings.grid ? v * 0.25 : v,
    ) as Vec3;
    const pieces = moveChain(track.pieces, selected, adjusted, turn);
    const moved = pieces.filter(
      (p) => p !== track.pieces.find((x) => x.id === p.id),
    );
    if (
      moved.some(
        (p) => p.position[1] < 0.18 || p.position.some((n) => Math.abs(n) > 65),
      )
    ) {
      notify("Keep pieces above the table and within the workbench.");
      return;
    }
    edit((t) => ({ ...t, pieces }));
  };
  const place = useCallback(
    (anchorOverride?: string) => {
      if (mode !== "build" || !tool) return;
      const previous =
        trackRef.current.pieces.find(
          (p) => p.id === (anchorOverride || attachId),
        ) || openEnds(trackRef.current.pieces).at(-1);
      if (!previous) {
        notify("Select a piece to attach to, or load a preset.");
        return;
      }
      const p = attach(previous, tool);
      p.yaw += rotatePreview;
      const displacedIds = new Set(
        downstream(trackRef.current.pieces, previous.id)
          .slice(1)
          .map((q) => q.id),
      );
      const pieces = insertPiece(trackRef.current.pieces, previous, p);
      const error =
        Math.abs(Math.sin(rotatePreview / 2)) > 0.02
          ? "Rotate the entrance to align with this connector."
          : placementError(
              p,
              trackRef.current.pieces.filter((q) => !displacedIds.has(q.id)),
            ) ||
            pieces
              .filter((q) => displacedIds.has(q.id))
              .map((q) => placementError(q, []))
              .find(Boolean);
      if (error) {
        notify(error);
        return;
      }
      edit((t) => ({ ...t, pieces }));
      setSelected(p.id);
      setMobileLibrary(false);
      setAttachId(p.id);
      setTool(null);
      setRotatePreview(0);
      scene.current?.bench?.sound.play("place");
      notify(`${DEFINITIONS[tool].name} snapped into place.`);
    },
    [mode, tool, attachId, rotatePreview, edit, notify],
  );
  const chooseTool = (type: PieceType) => {
    if (mode === "run") {
      notify("Switch to Build to change the track.");
      return;
    }
    if (type === "start" && !track.pieces.some((p) => p.type === "start")) {
      const p = {
        id: crypto.randomUUID(),
        type,
        position: [-4, 5, 0] as Vec3,
        yaw: 0,
        color: "coral" as ColorName,
      };
      edit((t) => ({ ...t, pieces: [...t.pieces, p] }));
      setSelected(p.id);
      return;
    }
    setTool(type);
    setRotatePreview(0);
    if (selectedPiece && selectedPiece.type !== "finish")
      setAttachId(selectedPiece.id);
    else {
      const finish = track.pieces.find((p) => p.type === "finish");
      const beforeFinish = finish
        ? track.pieces.find((p) => connected(p, finish))
        : undefined;
      setAttachId(ends.at(-1)?.id ?? beforeFinish?.id ?? null);
    }
    setMobileLibrary(false);
  };
  const loadPreset = (name: string) => {
    build();
    edit((t) => ({ ...preset(name), settings: t.settings }));
    setSelected(null);
    setDialog(null);
    setGuidance(false);
    notify(`${name} is on the workbench. Undo restores your previous track.`);
    setTimeout(() => scene.current?.bench?.cameraView("home"), 80);
  };
  const presetLoaderRef = useRef(loadPreset);
  presetLoaderRef.current = loadPreset;
  useEffect(
    () =>
      registerWorkshopTools(
        () => trackRef.current,
        (name) => presetLoaderRef.current(name),
      ),
    [],
  );
  const exportPNG = async () => {
    if (!scene.current?.bench) return;
    setPngBusy(true);
    try {
      const blob = await scene.current.bench.capture();
      download(blob, `${track.name.replace(/[^a-z0-9-_]/gi, "-")}.png`);
      notify("Your workbench photograph is ready.");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not export the image.");
    } finally {
      setPngBusy(false);
    }
  };
  const importFile = async (file: File) => {
    try {
      if (file.size > 200000)
        throw new Error("Choose a JSON file smaller than 200 KB.");
      const data = parseTrack(await file.text());
      build();
      edit(() => data);
      setSelected(null);
      setImportError("");
      setDialog(null);
      notify(`Imported “${data.name}”. Undo restores your previous track.`);
      setTimeout(() => scene.current?.bench?.cameraView("fit"), 100);
    } catch (e) {
      setImportError(
        e instanceof Error ? e.message : "Could not read this file.",
      );
    }
  };
  useEffect(() => {
    if (initial.error && hist.past.length === 0) {
      setSaveStatus("Not saved");
      return;
    }
    setSaveStatus("Saving…");
    const timer = setTimeout(() => {
      try {
        saveTrack(track);
        setSaveStatus("Saved locally");
      } catch {
        setSaveStatus("Not saved");
        notify(
          "Browser storage is unavailable or full. Export JSON to keep your creation.",
        );
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [track, notify]);
  useEffect(() => {
    if (ready) {
      const id = setTimeout(() => {
        try {
          setPreviews(makePreviews());
        } catch {
          /* The live scene remains available when thumbnail rendering is constrained. */
        }
      }, 30);
      return () => clearTimeout(id);
    }
  }, [ready]);
  useEffect(() => {
    if (dialog) {
      dialogRef.current?.showModal();
    } else dialogRef.current?.close();
  }, [dialog]);
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches("input,textarea,select") || dialog)
        return;
      if (e.code === "Space") {
        e.preventDefault();
        play();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? doRedo() : doUndo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        doRedo();
      }
      if (e.key === "Escape") {
        setTool(null);
        setSelected(null);
        setPhoto(false);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove();
      }
      if (e.key.toLowerCase() === "r" && mode === "build") {
        if (tool) setRotatePreview((r) => r + Math.PI / 2);
        else if (selected) moveSelected([0, 0, 0], Math.PI / 2);
      }
      if (e.key === "Enter" && tool) {
        e.preventDefault();
        place();
      }
      if (e.key.toLowerCase() === "f") scene.current?.bench?.cameraView("fit");
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [
    play,
    doUndo,
    doRedo,
    dialog,
    remove,
    mode,
    tool,
    selected,
    place,
    track,
  ]);
  useEffect(() => {
    if (
      stats.total > 0 &&
      stats.finished + stats.fallen === stats.total &&
      playing
    ) {
      setPlaying(false);
      notify(
        stats.finished === stats.total
          ? "A perfect run. Every marble made it home."
          : `${stats.finished} home, ${stats.fallen} off track. Adjust your build and try again.`,
      );
    }
  }, [stats.finished, stats.fallen, stats.total, playing, notify]);
  const events: SceneEvents = {
    select: (id) => {
      setSelected(id);
      if (id) {
        setRightOpen(true);
        setMobileSettings(true);
      }
    },
    attach: (id) => {
      setAttachId(id);
      if (tool) place(id);
      else {
        setSelected(id);
        notify("Choose a piece from the drawer to extend this connector.");
      }
    },
    marble: (index) => {
      setFollow(index);
      setMode("run");
      notify(
        `Following marble ${index + 1}. Drag the scene to leave follow mode.`,
      );
    },
    stats: setStats,
    ready: () => setReady(true),
    error: notify,
    labels: (labels) => {
      for (const key of ["start", "finish"] as const) {
        const el = document.getElementById(`scene-label-${key}`),
          pos = labels[key];
        if (el && pos) {
          el.style.transform = `translate(${pos[0]}px,${pos[1]}px)`;
          el.style.visibility = "visible";
        } else if (el) el.style.visibility = "hidden";
      }
    },
    followExit: () => setFollow(null),
  };
  const visiblePieces = (Object.keys(DEFINITIONS) as PieceType[]).filter(
    (k) => category === "All pieces" || DEFINITIONS[k].category === category,
  );
  const cameraAction = (kind: "home" | "fit" | "top") => {
    scene.current?.bench?.cameraView(kind);
    setTopView(kind === "top");
    setFollow(null);
  };
  return (
    <div
      className={`app ${photo ? "photo-mode" : ""} ${!leftOpen ? "library-closed" : ""} ${!rightOpen ? "inspector-closed" : ""} ${mobileLibrary ? "mobile-library-open" : ""}`}
    >
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => e.preventDefault()}
          aria-label="Marble Run Lab home"
        >
          <span className="brand-mark">
            <svg viewBox="0 0 40 40" aria-hidden="true">
              <path d="M9 29V16a5.5 5.5 0 0 1 11 0v12a5.5 5.5 0 0 0 11 0V15" />
              <circle cx="31" cy="9" r="4" />
            </svg>
          </span>
          <span>
            marble run<span className="brand-lab">lab</span>
          </span>
        </a>
        <div className="track-title">
          <input
            aria-label="Track name"
            value={track.name}
            maxLength={80}
            onChange={(e) => edit((t) => ({ ...t, name: e.target.value }))}
            onBlur={() => {
              if (!track.name.trim())
                edit((t) => ({ ...t, name: "Untitled track" }));
            }}
          />
          <Pencil size={12} />
          <span
            className={`save-state ${saveStatus === "Not saved" ? "save-failed" : ""}`}
          >
            {saveStatus === "Saved locally" ? <CheckCheck size={14} /> : null}
            {saveStatus}
          </span>
        </div>
        <div className="top-actions">
          <div className="history-buttons">
            <IconButton
              label="Undo (⌘Z)"
              disabled={!hist.past.length}
              onClick={doUndo}
            >
              <Undo2 size={17} />
            </IconButton>
            <IconButton
              label="Redo (⌘⇧Z)"
              disabled={!hist.future.length}
              onClick={doRedo}
            >
              <Redo2 size={17} />
            </IconButton>
          </div>
          <button
            className="preset-button"
            aria-label="Browse presets"
            onClick={() => setDialog("presets")}
          >
            <Layers3 size={16} />
            <span>Presets</span>
            <ChevronDown size={13} />
          </button>
          <button className="export-button" onClick={() => setDialog("export")}>
            <Download size={16} />
            <span>Export</span>
            <ChevronDown size={13} />
          </button>
        </div>
      </header>
      <main className="workspace">
        <Scene
          ref={scene}
          track={track}
          events={events}
          selected={selected}
          mode={mode}
          playing={playing}
          speed={speed}
          follow={follow}
          preview={preview}
          valid={!invalid}
          photo={photo}
        />
        <div className="scene-overlay">
          <div className="workbench-heading">
            <span className="workbench-label">
              <span className="tiny-cube" />
              <span>Your little gravity playground</span>
            </span>
            <h1>
              Small pieces.
              <br />
              Endless possibilities.
            </h1>
            <p>Make something that moves you.</p>
          </div>
          <div className="scene-label start-label" id="scene-label-start">
            <span className="label-dot" />
            START HERE
          </div>
          <div className="scene-label finish-label" id="scene-label-finish">
            <Flag size={10} />
            THE FINISH LINE
          </div>
        </div>
        <aside
          className={`piece-library ${leftOpen ? "is-open" : ""}`}
          aria-label="Track piece library"
        >
          <div className="panel-title">
            <div>
              <h2>
                The parts drawer<span className="count-label">11</span>
              </h2>
              <p>A little piece of your next big idea.</p>
            </div>
            <IconButton
              label="Collapse parts drawer"
              onClick={() => {
                setLeftOpen(false);
                setMobileLibrary(false);
              }}
            >
              <PanelLeftClose size={17} />
            </IconButton>
          </div>
          <div
            className="library-tabs"
            role="tablist"
            aria-label="Piece categories"
          >
            {["All pieces", "Essentials", "Twists & turns", "Specials"].map(
              (c) => (
                <button
                  role="tab"
                  aria-selected={category === c}
                  className={category === c ? "selected" : ""}
                  key={c}
                  onClick={() => setCategory(c)}
                >
                  {c === "Twists & turns"
                    ? "Curves"
                    : c === "All pieces"
                      ? "All"
                      : c}
                </button>
              ),
            )}
          </div>
          <div className="piece-grid">
            {visiblePieces.map((type) => (
              <button
                key={type}
                className={`piece-card ${tool === type ? "chosen" : ""}`}
                disabled={mode === "run"}
                onClick={() => chooseTool(type)}
                title={`${DEFINITIONS[type].detail} Click to preview placement.`}
              >
                <span className="piece-picture">
                  {previews[type] ? (
                    <img src={previews[type]} alt="" />
                  ) : (
                    <Box size={30} color={COLORS[DEFINITIONS[type].color]} />
                  )}
                  <span className="piece-add">
                    <Plus size={13} />
                  </span>
                </span>
                <span className="piece-name">{DEFINITIONS[type].name}</span>
                <span className="piece-kind">
                  {type === "down"
                    ? "Build some speed"
                    : type === "up"
                      ? "Keep the momentum"
                      : type === "loop"
                        ? "A gravity-defying twist"
                        : type === "finish"
                          ? "Bring it home"
                          : type === "start"
                            ? "Ready, set, roll"
                            : type === "funnel"
                              ? "Around we go"
                              : type === "tunnel"
                                ? "Hide & seek"
                                : type === "s-curve"
                                  ? "Find your flow"
                                  : type === "straight"
                                    ? "Keep things rolling"
                                    : type === "curve"
                                      ? "Go with the bend"
                                      : "Change direction"}
                </span>
              </button>
            ))}
          </div>
          <label className="select-piece-label">
            Select on track
            <select
              aria-label="Select a track piece"
              value={selected ?? ""}
              onChange={(e) => {
                setSelected(e.target.value || null);
                setRightOpen(true);
                setMobileSettings(true);
                setMobileLibrary(false);
              }}
            >
              <option value="">Choose a piece…</option>
              {track.pieces.map((p, i) => (
                <option key={p.id} value={p.id}>
                  {i + 1}. {DEFINITIONS[p.type].name}
                </option>
              ))}
            </select>
          </label>
          <div className="library-tip">
            <MousePointer2 size={17} />
            <p>
              Pick a piece, then click an open
              <br />
              connector to snap it into place.
            </p>
          </div>
        </aside>
        {!leftOpen && (
          <button
            className="reopen-parts floating-button"
            onClick={() => setLeftOpen(true)}
          >
            <PanelLeftOpen size={17} />
            Parts drawer
          </button>
        )}
        <button
          className="mobile-parts floating-button"
          onClick={() => {
            setMobileLibrary((o) => !o);
            setLeftOpen(true);
            setMobileSettings(false);
          }}
        >
          <Box size={18} />
          {mobileLibrary ? "Close parts" : "Add a piece"}
        </button>
        <aside
          className={`inspector ${rightOpen ? "is-open" : ""} ${mobileSettings ? "mobile-settings" : ""}`}
          aria-label={
            selectedPiece ? "Selected piece controls" : "Run settings"
          }
        >
          <div className="inspector-heading">
            <span>
              <SlidersHorizontal size={16} />
              {selectedPiece && mode === "build"
                ? "Piece settings"
                : "Make it your run"}
            </span>
            <IconButton
              label="Collapse inspector"
              onClick={() => {
                setRightOpen(false);
                setMobileSettings(false);
              }}
            >
              <X size={15} />
            </IconButton>
          </div>
          {selectedPiece && mode === "build" ? (
            <div className="selected-inspector">
              <div className="selected-preview">
                {previews[selectedPiece.type] && (
                  <img src={previews[selectedPiece.type]} alt="" />
                )}
              </div>
              <h2>{DEFINITIONS[selectedPiece.type].name}</h2>
              <p>{DEFINITIONS[selectedPiece.type].detail}</p>
              <label className="field-label">Piece color</label>
              <div className="color-options">
                {(Object.keys(COLORS) as ColorName[]).map((c) => (
                  <button
                    key={c}
                    aria-label={`Paint piece ${c}`}
                    aria-pressed={selectedPiece.color === c}
                    className={selectedPiece.color === c ? "chosen" : ""}
                    style={{ backgroundColor: COLORS[c] }}
                    onClick={() =>
                      edit((t) => ({
                        ...t,
                        pieces: t.pieces.map((p) =>
                          p.id === selected ? { ...p, color: c } : p,
                        ),
                      }))
                    }
                  >
                    {selectedPiece.color === c && <Check size={14} />}
                  </button>
                ))}
              </div>
              <div className="position-label">
                <span>Position</span>
                <span>
                  {selectedPiece.position.map((n) => n.toFixed(1)).join(" / ")}
                </span>
              </div>
              <div className="move-buttons">
                <IconButton
                  label="Move left"
                  onClick={() => moveSelected([-1, 0, 0])}
                >
                  <ArrowLeft size={17} />
                </IconButton>
                <IconButton
                  label="Move backward"
                  onClick={() => moveSelected([0, 0, -1])}
                >
                  <ArrowUp size={17} />
                </IconButton>
                <IconButton
                  label="Move forward"
                  onClick={() => moveSelected([0, 0, 1])}
                >
                  <ArrowDown size={17} />
                </IconButton>
                <IconButton
                  label="Move right"
                  onClick={() => moveSelected([1, 0, 0])}
                >
                  <ArrowRight size={17} />
                </IconButton>
              </div>
              <div className="height-control">
                <span>Elevation</span>
                <IconButton
                  label="Lower connected pieces"
                  onClick={() => moveSelected([0, -0.5, 0])}
                >
                  <Minus size={14} />
                </IconButton>
                <span>{selectedPiece.position[1].toFixed(1)} m</span>
                <IconButton
                  label="Raise connected pieces"
                  onClick={() => moveSelected([0, 0.5, 0])}
                >
                  <Plus size={14} />
                </IconButton>
              </div>
              <p className="inspector-note">
                Move and rotate carries connected pieces after this one.
              </p>
              <div className="piece-actions">
                <button onClick={() => moveSelected([0, 0, 0], Math.PI / 2)}>
                  <RotateCw size={15} />
                  Rotate
                </button>
                <button onClick={duplicate}>
                  <Copy size={15} />
                  Duplicate
                </button>
                <button className="delete-button" onClick={remove}>
                  <Trash2 size={15} />
                  Delete
                </button>
              </div>
              <button
                className="full-button subtle"
                onClick={() => {
                  setAttachId(selectedPiece.id);
                  setTool("straight");
                }}
              >
                <Plus size={15} />
                Attach a piece here
              </button>
            </div>
          ) : (
            <>
              <div className="marble-settings">
                <label className="field-label">Your marbles</label>
                <div className="marble-display" aria-hidden="true">
                  <span
                    className={`showcase-marble marble-gold ${track.settings.appearance}`}
                  />
                  <span
                    className={`showcase-marble marble-coral ${track.settings.appearance}`}
                  />
                  <span
                    className={`showcase-marble marble-blue ${track.settings.appearance}`}
                  />
                  <span className="marble-shadow" />
                </div>
                <div className="marble-count">
                  <span>How many?</span>
                  <div>
                    <IconButton
                      label="Remove a marble"
                      disabled={track.settings.count <= 1 || mode === "run"}
                      onClick={() =>
                        settings({ count: track.settings.count - 1 })
                      }
                    >
                      <Minus size={14} />
                    </IconButton>
                    <output aria-label="Marble count">
                      {track.settings.count}
                    </output>
                    <IconButton
                      label="Add a marble"
                      disabled={track.settings.count >= 12 || mode === "run"}
                      onClick={() =>
                        settings({ count: track.settings.count + 1 })
                      }
                    >
                      <Plus size={14} />
                    </IconButton>
                  </div>
                </div>
                <div
                  className="marble-styles"
                  role="group"
                  aria-label="Marble appearance"
                >
                  {(["classic", "candy", "metal", "glass"] as const).map(
                    (s) => (
                      <button
                        key={s}
                        aria-pressed={track.settings.appearance === s}
                        disabled={mode === "run"}
                        className={
                          track.settings.appearance === s ? "selected" : ""
                        }
                        onClick={() => settings({ appearance: s })}
                      >
                        {s === "classic"
                          ? "Classic"
                          : s === "candy"
                            ? "Swirl"
                            : s === "metal"
                              ? "Metal"
                              : "Glass"}
                      </button>
                    ),
                  )}
                </div>
              </div>
              <div className="run-stats" aria-label="Run statistics">
                <div>
                  <span>Run time</span>
                  <strong>
                    {stats.elapsed.toFixed(1)}
                    <small>s</small>
                  </strong>
                </div>
                <div>
                  <span>Made it</span>
                  <strong>
                    {stats.finished}
                    <small>/ {track.settings.count}</small>
                  </strong>
                </div>
                <div>
                  <span>Off track</span>
                  <strong>{stats.fallen}</strong>
                </div>
              </div>
              <div className="settings-row">
                <label htmlFor="quality">Render quality</label>
                <select
                  id="quality"
                  value={track.settings.quality}
                  onChange={(e) =>
                    settings({ quality: e.target.value as "high" | "low" })
                  }
                >
                  <option value="high">High</option>
                  <option value="low">Light</option>
                </select>
              </div>
              <div className="inspector-foot">
                <span className="status-dot" />
                {mode === "build"
                  ? "Ready when you are."
                  : playing
                    ? "A little gravity at work."
                    : stats.elapsed > 0
                      ? "A moment to pause."
                      : "All lined up. Let’s roll."}
              </div>
            </>
          )}
        </aside>
        {
          <button
            className={`reopen-inspector floating-button ${rightOpen ? "mobile-only" : ""}`}
            onClick={() => {
              setRightOpen(true);
              setMobileSettings((o) => !o);
              setMobileLibrary(false);
            }}
            aria-label="Open run settings"
          >
            <SlidersHorizontal size={17} />
          </button>
        }
        <div className="camera-tools" aria-label="Camera controls">
          <IconButton label="Reset camera" onClick={() => cameraAction("home")}>
            <Home size={18} />
          </IconButton>
          <IconButton
            label="Fit entire track (F)"
            onClick={() => cameraAction("fit")}
          >
            <Maximize size={18} />
          </IconButton>
          <IconButton
            label="Top-down construction view"
            active={topView}
            onClick={() => cameraAction(topView ? "home" : "top")}
          >
            <Grid2X2 size={18} />
          </IconButton>
          <span className="tool-divider" />
          <IconButton
            label="Photo mode"
            onClick={() => {
              setPhoto(true);
              setMobileLibrary(false);
              setMobileSettings(false);
            }}
          >
            <Camera size={18} />
          </IconButton>
        </div>
        {tool && mode === "build" && (
          <div className={`placement-bar ${invalid ? "invalid" : ""}`}>
            <span>
              {invalid ? <TriangleAlert size={17} /> : <Box size={17} />}
              <span>
                <strong>{DEFINITIONS[tool].name}</strong>
                <small>
                  {invalid ||
                    (!anchor
                      ? "Choose a connecting piece."
                      : "Preview aligned to the selected connector.")}
                </small>
              </span>
            </span>
            <IconButton
              label="Rotate preview (R)"
              onClick={() => setRotatePreview((v) => v + Math.PI / 2)}
            >
              <RotateCw size={17} />
            </IconButton>
            <button
              className="place-button"
              disabled={!!invalid || !anchor}
              onClick={() => place()}
            >
              <Check size={16} />
              Place piece
            </button>
            <IconButton label="Cancel placement" onClick={() => setTool(null)}>
              <X size={16} />
            </IconButton>
          </div>
        )}
        {guidance && !tool && (
          <div className="guidance">
            <span className="guidance-spark">
              <MoveUpRight size={17} />
            </span>
            <span>
              Run the track. Add a piece. <strong>Make it yours.</strong>
            </span>
            <IconButton
              label="Dismiss getting started tip"
              onClick={() => setGuidance(false)}
            >
              <X size={14} />
            </IconButton>
          </div>
        )}
        <div className="mobile-stats" aria-live="off">
          <span>
            <strong>{stats.elapsed.toFixed(1)} s</strong>
          </span>
          <span>
            <strong>
              {stats.finished}/{stats.total}
            </strong>{" "}
            home
          </span>
          <span>
            <strong>{stats.fallen}</strong> off track
          </span>
        </div>
        <div className="track-collection">
          <div className="collection-label">
            A little inspiration <span>Start with a ready-made run</span>
          </div>
          <div className="preset-strip">
            {PRESETS.map((p, i) => (
              <button
                key={p.name}
                className={`preset-mini ${track.name === p.name ? "selected" : ""}`}
                onClick={() => loadPreset(p.name)}
              >
                <span className="preset-image">
                  {previews[p.name] && <img src={previews[p.name]} alt="" />}
                </span>
                <span>
                  <strong>{p.name}</strong>
                  <small>{p.level}</small>
                </span>
                {track.name === p.name ? (
                  <Check size={13} />
                ) : (
                  <ArrowUpRight size={13} />
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="transport">
          <div className="mode-switch" role="group" aria-label="Workshop mode">
            <button
              aria-label="Build mode"
              aria-pressed={mode === "build"}
              className={mode === "build" ? "selected" : ""}
              onClick={build}
            >
              <Box size={16} />
              <span>Build</span>
            </button>
            <button
              aria-label="Run mode"
              aria-pressed={mode === "run"}
              className={mode === "run" ? "selected" : ""}
              onClick={() => {
                setMode("run");
                setTool(null);
              }}
            >
              <Play size={15} />
              <span>Run</span>
            </button>
          </div>
          <span className="transport-divider" />
          <button className="play-button" disabled={!ready} onClick={play}>
            {playing ? (
              <Pause size={19} fill="currentColor" />
            ) : (
              <Play size={19} fill="currentColor" />
            )}
            <span>
              {playing
                ? "Pause"
                : stats.elapsed > 0
                  ? stats.finished + stats.fallen === stats.total
                    ? "Run again"
                    : "Resume"
                  : "Let’s roll"}
            </span>
            <kbd>space</kbd>
          </button>
          <IconButton label="Reset marbles" onClick={reset}>
            <RotateCcw size={18} />
          </IconButton>
          <span className="transport-divider" />
          <button
            className={`speed-button ${speed !== 1 ? "active" : ""}`}
            onClick={() => setSpeed((s) => (s === 1 ? 0.25 : 1))}
            aria-label={
              speed === 1 ? "Enable slow motion" : "Enable normal speed"
            }
          >
            {speed === 1 ? <Rabbit size={17} /> : <Turtle size={17} />}
            <span>{speed === 1 ? "1×" : ".25×"}</span>
            <ChevronDown size={12} />
          </button>
          <button
            className={`follow-button ${follow !== null ? "active" : ""}`}
            disabled={mode !== "run"}
            onClick={() => {
              const next = follow === null ? 0 : null;
              setFollow(next);
              if (next === null) cameraAction("home");
            }}
          >
            <Focus size={17} />
            <span>
              {follow === null ? "Follow marble" : `Marble ${follow + 1}`}
            </span>
          </button>
        </div>
        <footer className="workbench-footer">
          <div>
            <span className="footer-status" />
            {track.pieces.length} pieces<span className="footer-dot">·</span>
            {track.pieces.reduce((n, p) => n + lengthOf(p), 0).toFixed(1)} m of
            possibility
          </div>
          <span className="camera-hint">
            Drag to orbit<span>·</span>Scroll to zoom<span>·</span>Right-drag to
            pan
          </span>
          <div className="footer-controls">
            <IconButton
              label={track.settings.grid ? "Hide grid" : "Show grid"}
              active={track.settings.grid}
              onClick={() => settings({ grid: !track.settings.grid })}
            >
              <Grid2X2 size={16} />
            </IconButton>
            <IconButton
              label={track.settings.sound ? "Mute sound" : "Enable sound"}
              active={track.settings.sound}
              onClick={() => {
                settings({ sound: !track.settings.sound });
                const b = scene.current?.bench;
                if (b) {
                  b.sound.enabled = !track.settings.sound;
                  b.sound.play("place");
                }
              }}
            >
              {track.settings.sound ? (
                <Volume2 size={17} />
              ) : (
                <VolumeX size={17} />
              )}
            </IconButton>
            <IconButton
              label="Help and keyboard shortcuts"
              onClick={() => setDialog("help")}
            >
              <HelpCircle size={17} />
            </IconButton>
          </div>
        </footer>
        {photo && (
          <div className="photo-controls">
            <span>
              <Camera size={19} />A little work of art.
            </span>
            <button onClick={exportPNG} disabled={pngBusy}>
              <Download size={16} />
              {pngBusy ? "Developing…" : "Save photograph"}
            </button>
            <IconButton label="Exit photo mode" onClick={() => setPhoto(false)}>
              <X size={18} />
            </IconButton>
          </div>
        )}
        {notice && (
          <div className="toast" role="status">
            <Check size={16} />
            <span>{notice}</span>
            <IconButton
              label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              <X size={13} />
            </IconButton>
          </div>
        )}
      </main>
      <dialog
        ref={dialogRef}
        className={`lab-dialog ${dialog === "presets" ? "preset-dialog" : ""}`}
        onCancel={() => setDialog(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setDialog(null);
        }}
      >
        <div className="dialog-heading">
          <div>
            <h2>
              {dialog === "export"
                ? "Keep a little possibility."
                : dialog === "presets"
                  ? "A running start."
                  : "Welcome to your workbench."}
            </h2>
            <p>
              {dialog === "export"
                ? "Save your creation. Share your next great idea."
                : dialog === "presets"
                  ? "Three little machines, ready for your imagination."
                  : "Everything you need to make things roll."}
            </p>
          </div>
          <IconButton label="Close dialog" onClick={() => setDialog(null)}>
            <X size={19} />
          </IconButton>
        </div>
        {dialog === "export" && (
          <>
            <div className="export-options">
              <button
                onClick={() => {
                  download(
                    new Blob([serialize(track)], { type: "application/json" }),
                    `${track.name.replace(/[^a-z0-9-_]/gi, "-")}.marble.json`,
                  );
                  notify(
                    "Track exported. Import the JSON to build on it later.",
                  );
                }}
              >
                <span className="export-icon">
                  <FileJson size={24} />
                </span>
                <span>
                  <strong>Export track</strong>
                  <small>A versioned JSON file you can open again.</small>
                </span>
                <Download size={18} />
              </button>
              <button onClick={exportPNG} disabled={pngBusy}>
                <span className="export-icon coral">
                  <Image size={24} />
                </span>
                <span>
                  <strong>
                    {pngBusy ? "Developing photograph…" : "Save a photograph"}
                  </strong>
                  <small>A clean PNG of the current camera view.</small>
                </span>
                <Download size={18} />
              </button>
              <button onClick={() => fileRef.current?.click()}>
                <span className="export-icon blue">
                  <Upload size={24} />
                </span>
                <span>
                  <strong>Import a track</strong>
                  <small>Pick up where another creation left off.</small>
                </span>
                <ArrowUpRight size={18} />
              </button>
            </div>
            <input
              className="sr-only"
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importFile(f);
                e.target.value = "";
              }}
            />
            {importError && (
              <p className="error-message" role="alert">
                {importError} Your current track is unchanged.
              </p>
            )}
            <p className="dialog-footnote">
              <CheckCheck size={14} />
              Your track is automatically saved in this browser.
            </p>
          </>
        )}
        {dialog === "presets" && (
          <>
            <div className="preset-gallery">
              {PRESETS.map((p) => (
                <button key={p.name} onClick={() => loadPreset(p.name)}>
                  <div>
                    {previews[p.name] && (
                      <img
                        src={previews[p.name]}
                        alt={`${p.name} miniature track preview`}
                      />
                    )}
                  </div>
                  <span className="preset-level">{p.level}</span>
                  <h3>{p.name}</h3>
                  <p>{p.tag}</p>
                  <span className="preset-load">
                    Open on workbench
                    <ArrowUpRight size={16} />
                  </span>
                </button>
              ))}
            </div>
            <p className="dialog-footnote">
              <Undo2 size={14} />
              Changed your mind? Undo brings back your current creation.
            </p>
          </>
        )}
        {dialog === "help" && (
          <>
            <div className="help-steps">
              <p>
                <strong>1. Let it roll.</strong> Press Play or Space to release
                the gate. Pause, slow down, or follow a marble along the track.
              </p>
              <p>
                <strong>2. Make it yours.</strong> Return to Build. Choose a
                piece to preview it before the finish tray. Click Place piece,
                or select another piece and attach to its connector.
              </p>
              <p>
                <strong>3. Keep creating.</strong> Select pieces to move,
                rotate, color, or duplicate. Moves carry the connected pieces
                after them; deletion leaves a gap. Undo makes experiments safe.
              </p>
            </div>
            <div className="shortcut-list">
              {[
                ["Play / pause", "Space"],
                ["Place preview", "Enter"],
                ["Rotate piece / preview", "R"],
                ["Fit the track", "F"],
                ["Delete selected piece", "Delete"],
                ["Undo / redo", "⌘ Z / ⌘ ⇧ Z"],
                ["Cancel / leave photo mode", "Esc"],
              ].map(([a, b]) => (
                <div key={a}>
                  <span>{a}</span>
                  <kbd>{b}</kbd>
                </div>
              ))}
            </div>
            <p className="dialog-footnote">
              Touch: drag to orbit. Use two fingers to pan and pinch to zoom. A
              loop needs enough height before it to build momentum.
            </p>
          </>
        )}
      </dialog>
    </div>
  );
}
