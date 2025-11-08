import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
// import StepControls from "./StepControls";
import StepControls from "../components/StepControls";

const VizCtx = createContext(null);
function useViz() {
  const ctx = useContext(VizCtx);
  if (!ctx) throw new Error("Visualizer context missing");
  return ctx;
}

export default function Visualizer({ jsonData, region, children }) {
  const storeRef = useRef(null);
  if (jsonData && !storeRef.current) {
    storeRef.current = makeStore(jsonData);
  }
  const store = storeRef.current;

  if (region === "left") return <LeftPane />;
  if (region === "center") return <CenterPane />;
  if (region === "right") return <RightPane />;
  if (region === "controls") return <ControlsPane />;

  return <VizCtx.Provider value={store}>{children}</VizCtx.Provider>;
}

/* ========================= STORE / ENGINE ========================= */

function makeStore(jsonData) {
  const base = structuredClone(jsonData.visualLayout?.structures || []);
  const initialStructs = base.map((s) =>
    s.type === "array"
      ? {
          ...s,
          data: s.data.map((v, i) => ({
            id: `${s.id}-${i}-${cryptoRandom()}`,
            value: v,
          })),
        }
      : s
  );

  const steps = jsonData.steps || [];
  const idxById = {};
  initialStructs.forEach((s, i) => (idxById[s.id] = i));

  const store = {
    jsonData,
    steps,
    idxById,
    state: {
      stepIdx: 0,
      playing: false,
      message: "",
      structures: initialStructs,
      highlights: {},
      marks: {},
      stats: { comparisons: 0, swaps: 0, updates: 0 },
      timer: null,
      busy: false,
    },
    subs: new Set(),

    publish() {
      this.subs.forEach((fn) => fn({ ...this.state }));
    },
    subscribe(fn) {
      this.subs.add(fn);
      return () => this.subs.delete(fn);
    },
    set(partial) {
      Object.assign(this.state, partial);
      this.publish();
    },
    resetToInitial() {
      const rebuilt = structuredClone(
        this.jsonData.visualLayout?.structures || []
      ).map((s) =>
        s.type === "array"
          ? {
              ...s,
              data: s.data.map((v, i) => ({
                id: `${s.id}-${i}-${cryptoRandom()}`,
                value: v,
              })),
            }
          : s
      );
      this.state.structures = rebuilt;
      this.state.highlights = {};
      this.state.marks = {};
      this.state.stats = { comparisons: 0, swaps: 0, updates: 0 };
      this.state.stepIdx = 0;
      this.state.message = "";
      this.clearTimer();
      this.state.busy = false;
      this.publish();
    },
    clearTimer() {
      if (this.state.timer) {
        clearTimeout(this.state.timer);
        this.state.timer = null;
      }
    },
    scheduleNext(delay) {
      this.clearTimer();
      this.state.timer = setTimeout(() => {
        this.state.timer = null;
        if (this.state.playing) this.next();
      }, delay);
    },

    getStruct(id) {
      const idx = this.idxById[id];
      return this.state.structures[idx];
    },
    setStruct(id, updater) {
      const idx = this.idxById[id];
      const clone = structuredClone(this.state.structures);
      clone[idx] = updater(clone[idx]);
      this.state.structures = clone;
      this.publish();
    },

    /* ---------- stepping API ---------- */

    next() {
      const idx = this.state.stepIdx;
      if (idx >= this.steps.length) {
        if (this.jsonData?.endMessage) {
          this.set({ message: this.jsonData.endMessage });
        }
        this.set({ playing: false, busy: false });
        return;
      }
      if (this.state.busy) return;
      this.set({ busy: true });

      const step = this.steps[idx];
      this.set({ message: step?.message || "" });
      const duration = runStep(this, step);

      const totalDelay = duration + 400;
      this.clearTimer();
      this.state.timer = setTimeout(() => {
        this.set({ stepIdx: idx + 1, busy: false });
        if (this.state.playing) this.next();
      }, totalDelay);
    },

    prev() {
      const target = Math.max(0, this.state.stepIdx - 1);
      this.resetToInitial();
      for (let i = 0; i < target; i++) {
        const step = this.steps[i];
        runStep(this, step, true);
      }
      this.set({ stepIdx: target, playing: false });
    },
  };

  return store;
}

/* ========================= ACTION EXECUTION ========================= */

function runStep(store, step, instant = false) {
  if (!step) return 300;
  if (
    step.condition?.expression &&
    !evalCondition(store, step.condition.expression)
  ) {
    return 200;
  }

  if (step.highlight?.length) {
    const hmap = {};
    step.highlight.forEach((h) => {
      if (h.structure == null || h.index == null) return;
      if (!hmap[h.structure]) hmap[h.structure] = [];
      hmap[h.structure].push(h.index);
    });
    store.set({ highlights: hmap });
  } else {
    store.set({ highlights: {} });
  }

  // Update variables from stateChange
  if (step.stateChange) {
    Object.entries(step.stateChange).forEach(([varId, newValue]) => {
      const struct = store.getStruct(varId);
      if (struct && struct.type === "variable") {
        store.setStruct(varId, (v) => ({ ...v, value: newValue }));
      }
    });
  }

  const a = step.action;
  let duration = 350;

  switch (a) {
    case "compare": {
      store.set({
        stats: {
          ...store.state.stats,
          comparisons: store.state.stats.comparisons + 1,
        },
      });
      duration = 600;
      break;
    }
    case "swap": {
      const [e1, e2] = step.elements || [];
      if (e1?.structure && e2?.structure && e1.structure === e2.structure) {
        store.setStruct(e1.structure, (arr) => {
          const data = arr.data.slice();
          [data[e1.index], data[e2.index]] = [data[e2.index], data[e1.index]];
          return { ...arr, data };
        });
        store.set({
          stats: { ...store.state.stats, swaps: store.state.stats.swaps + 1 },
        });
      }
      duration = 1000;
      break;
    }
    case "mark": {
      const m = {};
      (step.elements || []).forEach((e) => {
        if (!e.structure || e.index == null) return;
        if (!m[e.structure]) m[e.structure] = [];
        m[e.structure].push(e.index);
      });
      store.set({ marks: m });
      duration = 400;
      break;
    }
    case "pointerMove": {
      (step.elements || []).forEach((e) => {
        if (!e.structure) return;
        if (e.value !== undefined) {
          store.setStruct(e.structure, (v) => ({ ...v, value: e.value }));
        }
      });
      duration = 500;
      break;
    }
    case "update": {
      (step.elements || []).forEach((e) => {
        if (!e.structure) return;
        if (e.index !== undefined) {
          store.setStruct(e.structure, (arr) => {
            const data = arr.data.slice();
            data[e.index] = { ...data[e.index], value: e.value };
            return { ...arr, data };
          });
        } else {
          store.setStruct(e.structure, (v) => ({ ...v, value: e.value }));
        }
      });
      store.set({
        stats: { ...store.state.stats, updates: store.state.stats.updates + 1 },
      });
      duration = 500;
      break;
    }
    default:
      duration = 300;
  }

  return instant ? 0 : duration;
}

/* ========================= HELPERS ========================= */

function cryptoRandom() {
  return Math.random().toString(36).slice(2, 8);
}

function evalCondition(store, expr) {
  const vars = Object.fromEntries(
    store.state.structures
      .filter((s) => s.type === "variable")
      .map((v) => [v.id, v.value])
  );
  try {
    return Boolean(
      Function(...Object.keys(vars), `return (${expr});`)(
        ...Object.values(vars)
      )
    );
  } catch {
    return true;
  }
}

/* ========================= PANES ========================= */

function LeftPane() {
  const store = useViz();
  const [snap, setSnap] = useState(store.state);
  useEffect(() => store.subscribe(setSnap), [store]);

  const vars = snap.structures.filter((s) => s.type === "variable");

  return (
    <div className="flex flex-col gap-3">
      {vars.map((v) => (
        <motion.div
          key={v.id}
          layout
          className="flex items-center justify-between bg-gradient-to-r from-gray-800 to-gray-700 rounded-xl px-3 py-2 shadow-lg border border-gray-600"
        >
          <span className="text-gray-300 text-sm font-semibold">
            {v.label || v.id}
          </span>
          <motion.span
            layoutId={`var-${v.id}`}
            className="text-cyan-300 text-lg font-bold"
            key={v.value}
          >
            {String(v.value)}
          </motion.span>
        </motion.div>
      ))}
    </div>
  );
}

function CenterPane() {
  const store = useViz();
  const [snap, setSnap] = useState(store.state);
  useEffect(() => store.subscribe(setSnap), [store]);

  useEffect(() => {
    if (store.state.stepIdx === 0 && !store.state.playing) {
      store.set({ playing: true });
      store.next();
    }
  }, [store]);

  const arrays = snap.structures.filter((s) => s.type === "array");

  return (
    <div className="flex flex-col items-center gap-8 relative w-full">
      {/* Array visual area */}
      <div className="flex flex-col items-center gap-8 mt-8">
        {arrays.map((s) => (
          <div key={s.id} className="flex flex-col items-center gap-3">
            <h3 className="text-gray-300 text-sm font-semibold">
              {s.label || s.id}
            </h3>
            <ArrayView s={s} snap={snap} />
          </div>
        ))}
      </div>

      {/* Message Pane */}
      <MessagePane />
    </div>
  );
}

function ArrayView({ s, snap }) {
  const hl = new Set([...(snap.highlights[s.id] || [])]);
  const mk = new Set([...(snap.marks[s.id] || [])]);

  return (
    <motion.div
      className="flex justify-center gap-4"
      layout
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
    >
      <AnimatePresence mode="popLayout">
        {s.data.map((item, i) => {
          const isHighlighted = hl.has(i);
          const isMarked = mk.has(i);

          return (
            <motion.div
              key={item.id}
              layout
              layoutId={item.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: 1,
                scale: 1,
                y: isHighlighted ? -12 : 0,
                boxShadow: isHighlighted
                  ? "0 0 20px rgba(234, 179, 8, 0.6)"
                  : "0 4px 12px rgba(0, 0, 0, 0.3)",
              }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{
                type: "spring",
                stiffness: 350,
                damping: 25,
                duration: 0.4,
              }}
              className={`
                w-14 h-14 flex items-center justify-center font-bold rounded-lg
                select-none transition-all duration-300 text-sm font-mono
                ${
                  isMarked
                    ? "bg-gradient-to-br from-emerald-400 to-emerald-500 text-black shadow-emerald-500/50"
                    : isHighlighted
                    ? "bg-gradient-to-br from-yellow-300 to-yellow-400 text-black shadow-yellow-500/50"
                    : "bg-gradient-to-br from-cyan-400 to-blue-500 text-white"
                }
                ring-2 ${isHighlighted ? "ring-yellow-300" : "ring-gray-700"}
              `}
            >
              {item.value}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}

function RightPane() {
  const store = useViz();
  const [snap, setSnap] = useState(store.state);
  useEffect(() => store.subscribe(setSnap), [store]);

  return (
    <div className="flex flex-col gap-4">
      <motion.div
        layout
        className="bg-gradient-to-br from-purple-900 to-purple-800 rounded-xl px-4 py-3 border border-purple-700"
      >
        <div className="text-gray-300 text-xs uppercase tracking-wider font-semibold">
          Progress
        </div>
        <motion.div
          className="text-2xl font-bold text-purple-300 mt-1"
          key={snap.stepIdx}
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {`${snap.stepIdx} / ${store.steps.length}`}
        </motion.div>
      </motion.div>

      <Stat label="Comparisons" value={snap.stats.comparisons} color="blue" />
      <Stat label="Swaps" value={snap.stats.swaps} color="orange" />
      <Stat label="Updates" value={snap.stats.updates} color="green" />
    </div>
  );
}

function Stat({ label, value, color = "cyan" }) {
  const colorMap = {
    cyan: "from-cyan-900 to-cyan-800 border-cyan-700 text-cyan-300",
    blue: "from-blue-900 to-blue-800 border-blue-700 text-blue-300",
    orange: "from-orange-900 to-orange-800 border-orange-700 text-orange-300",
    green: "from-green-900 to-green-800 border-green-700 text-green-300",
  };

  return (
    <motion.div
      layout
      className={`bg-gradient-to-br ${colorMap[color]} rounded-xl px-4 py-3 border shadow-lg`}
    >
      <div className="text-gray-300 text-xs uppercase tracking-wider font-semibold">
        {label}
      </div>
      <motion.div
        className="text-2xl font-bold mt-1"
        key={value}
        initial={{ scale: 1.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
      >
        {value}
      </motion.div>
    </motion.div>
  );
}

function ControlsPane() {
  const store = useViz();
  const [snap, setSnap] = useState(store.state);
  useEffect(() => store.subscribe(setSnap), [store]);

  const total = store.steps.length;

  return (
    <motion.div layout>
      <StepControls
        onReset={() => {
          store.resetToInitial();
          store.set({ playing: false });
        }}
        onPrev={() => store.prev()}
        onNext={() => store.next()}
        onPlayPause={() => {
          const now = !snap.playing;
          store.set({ playing: now });
          if (now) store.next();
          else store.clearTimer();
        }}
        playing={snap.playing}
        step={Math.min(snap.stepIdx + 1, total)}
        total={total}
        disabled={snap.busy}
      />
    </motion.div>
  );
}

/* ========================= MESSAGE PANE ========================= */

function MessagePane() {
  const store = useViz();
  const [snap, setSnap] = useState(store.state);
  useEffect(() => store.subscribe(setSnap), [store]);

  return (
    <div className="w-full flex justify-center mt-12 min-h-[3.5rem] px-4">
      <AnimatePresence mode="wait">
        {snap.message && (
          <motion.div
            key={snap.stepIdx}
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 20,
              duration: 0.4,
            }}
            className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 text-gray-100 text-base font-medium text-center
              px-6 py-4 rounded-xl border border-blue-500/30 backdrop-blur-sm max-w-lg"
          >
            {snap.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export { useViz };