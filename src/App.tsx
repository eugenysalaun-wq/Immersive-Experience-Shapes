import { useEffect, useState } from "react"
import { ShapeRenderer, type Settings } from "./ShapeRenderer"

// ─── Constants ────────────────────────────────────────────────────────────────
const SLIDER_DEFS: { key: keyof Omit<Settings, "color">; label: string; left: string; right: string }[] = [
  { key: "movement", label: "Energy",        left: "Calm",        right: "Energetic"   },
  { key: "roundness",   label: "Attitude",      left: "Direct",      right: "Polite"      },
  { key: "sharpness",   label: "Behavior",      left: "Introverted", right: "Extroverted" },
  { key: "texture",     label: "Assertiveness", left: "Confident",    right: "Reserved"   },
  { key: "spacing",     label: "Proximity",     left: "Connected",   right: "Separated"   },
  { key: "size",        label: "Presence",      left: "Subtle",      right: "Noticeable"  },
]

const DEFAULT: Settings = {
  roundness: 0.65,
  sharpness: 0.35,
  spacing: 0.45,
  size: 0.60,
  deformation: 0.50,
  texture: 0.30,
  movement: 0.50,
  color: "#5BA88C",
  quantity: 4,
}

const COLOR_SPECTRUM = [
  "#C13C8F", // magenta
  "#D94A45", // red
  "#E8923A", // orange
  "#E7D928", // yellow
  "#A9C93A", // lime
  "#2FA144", // green
  "#18A7A6", // teal
  "#2E83C8", // blue
  "#6E57A8", // purple
  "#1A1A1A", // black
]

const STORAGE_KEY = "shape-studio-settings"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveColor(s: Settings): string {
  if (s.size < 0.12) return "#1C1C1C"
  const score = s.deformation * 0.30 + s.roundness * 0.20 + s.sharpness * 0.20
              + s.texture * 0.15 + s.spacing * 0.10 + s.size * 0.05
  return COLOR_SPECTRUM[Math.min(COLOR_SPECTRUM.length - 1, Math.floor(score * COLOR_SPECTRUM.length))]
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) }
  } catch {
    // localStorage unavailable (e.g. private mode) — fall back to defaults
  }
  return DEFAULT
}

// ─── ShapeSlider ──────────────────────────────────────────────────────────────

function ShapeSlider(p: {
  label: string
  left: string
  right: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
}) {  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: "#1c1c1c", marginBottom: 14, letterSpacing: "-0.01em" }}>
        {p.label}
      </div>
      <input
        type="range" min={p.min ?? 0} max={p.max ?? 1} step={p.step ?? 0.01} value={p.value}
        onChange={(e) => p.onChange(parseFloat(e.target.value))}
        className="shape-slider"
        style={{
          "--progress": `${
            ((p.value - (p.min ?? 0)) /
              ((p.max ?? 1) - (p.min ?? 0))) *
            100
          }%`,
        } as React.CSSProperties}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7 }}>
        <span style={{ fontSize: 11, color: "#B4B3AE" }}>{p.left}</span>
        <span style={{ fontSize: 11, color: "#B4B3AE" }}>{p.right}</span>
      </div>
    </div>
  )
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c

  let r = 0
  let g = 0
  let b = 0

  if (h < 60) {
    r = c
    g = x
  } else if (h < 120) {
    r = x
    g = c
  } else if (h < 180) {
    g = c
    b = x
  } else if (h < 240) {
    g = x
    b = c
  } else if (h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }

  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0")

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

function hexToHsv(hex: string) {
  const clean = hex.replace("#", "")

  const r = parseInt(clean.substring(0, 2), 16) / 255
  const g = parseInt(clean.substring(2, 4), 16) / 255
  const b = parseInt(clean.substring(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  let h = 0

  if (delta !== 0) {
    if (max === r) {
      h = 60 * (((g - b) / delta) % 6)
    } else if (max === g) {
      h = 60 * ((b - r) / delta + 2)
    } else {
      h = 60 * ((r - g) / delta + 4)
    }
  }

  if (h < 0) h += 360

  const s = max === 0 ? 0 : delta / max

  return {
    h,
    s,
    v: max,
  }
}

function ColorWheelPicker(p: {
  value: string
  onChange: (color: string) => void
}) {
  const hsv = hexToHsv(p.value)

  const angle = (hsv.h * Math.PI) / 180

  const pointerX =
    50 + Math.sin(angle) * hsv.s * 46

  const pointerY =
    50 - Math.cos(angle) * hsv.s * 46

  const updateWheel = (
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    const rect = e.currentTarget.getBoundingClientRect()

    const centerX = rect.width / 2
    const centerY = rect.height / 2

    const x = e.clientX - rect.left - centerX
    const y = e.clientY - rect.top - centerY

    const maxRadius = rect.width / 2

    const distance =
      Math.sqrt(x * x + y * y)

    const saturation =
      Math.min(distance / maxRadius, 1)

    let hue =
      (Math.atan2(x, -y) * 180) /
      Math.PI

    if (hue < 0) hue += 360

    p.onChange(
      hsvToHex(
        hue,
        saturation,
        hsv.v
      )
    )
  }

  const updateBrightness = (value: number) => {
    p.onChange(
      hsvToHex(
        hsv.h,
        hsv.s,
        value
      )
    )
  }

  return (
    <div
      style={{
        marginBottom: 30,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "#1c1c1c",
          marginBottom: 16,
          letterSpacing: "-0.01em",
        }}
      >
        Color
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(
              e.pointerId
            )

            updateWheel(e)
          }}
          onPointerMove={(e) => {
            if (
              e.currentTarget.hasPointerCapture(
                e.pointerId
              )
            ) {
              updateWheel(e)
            }
          }}
          style={{
            width: 210,
            height: 210,
            borderRadius: "50%",
            position: "relative",
            cursor: "crosshair",

            background: `
              radial-gradient(
                circle,
                white 0%,
                rgba(255,255,255,0.85) 15%,
                rgba(255,255,255,0) 70%
              ),
              conic-gradient(
                from 0deg,
                #ff0000,
                #ffff00,
                #00ff00,
                #00ffff,
                #0000ff,
                #ff00ff,
                #ff0000
              )
            `,
          }}
        >
          <div
            style={{
              position: "absolute",

              left: `${pointerX}%`,
              top: `${pointerY}%`,

              width: 18,
              height: 18,

              borderRadius: "50%",

              border: "3px solid white",

              boxShadow:
                "0 0 0 1px rgba(0,0,0,0.45), 0 2px 5px rgba(0,0,0,0.25)",

              transform:
                "translate(-50%, -50%)",

              pointerEvents: "none",
            }}
          />
        </div>
      </div>

      <div
        style={{
          marginTop: 22,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: "#B4B3AE",
            }}
          >
            Brightness
          </span>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: p.value,
                border:
                  "1px solid rgba(0,0,0,0.12)",
              }}
            />

            <span
              style={{
                fontSize: 10,
                color: "#B4B3AE",
                fontFamily: "monospace",
              }}
            >
              {p.value}
            </span>
          </div>
        </div>

        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={hsv.v}
          onChange={(e) =>
            updateBrightness(
              parseFloat(e.target.value)
            )
          }
          style={{
            width: "100%",
          }}
        />
      </div>
    </div>
  )
}

function ColorPicker(p: {
  colors: string[]
  value: string
  onChange: (color: string) => void
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "#1c1c1c",
          marginBottom: 16,
          letterSpacing: "-0.01em",
        }}
      >
        Color
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 16,
          justifyItems: "center",
        }}
      >
        {p.colors.map((color) => {
          const selected = p.value === color

          return (
            <button
              key={color}
              onClick={() => p.onChange(color)}
              aria-label={`Select color ${color}`}
              style={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                border: selected ? "2px solid #1c1c1c" : "1px solid transparent",
                outline: selected ? "4px solid rgba(91,168,140,0.55)" : "none",
                background: color,
                cursor: "pointer",
                padding: 0,
                boxShadow: selected
                  ? "0 0 0 6px rgba(91,168,140,0.18)"
                  : "0 1px 4px rgba(0,0,0,0.10)",
                transition: "transform 0.14s ease, box-shadow 0.14s ease",
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

type QuestionnaireProps = {
  onComplete: (generatedSettings: Settings) => void
}

function Questionnaire({ onComplete }: QuestionnaireProps) {
  const [answers, setAnswers] = useState({
    movement: DEFAULT.movement,
    roundness: DEFAULT.roundness,
    sharpness: DEFAULT.sharpness,
    texture: DEFAULT.texture,
    spacing: DEFAULT.spacing,
    size: DEFAULT.size,
    color: DEFAULT.color,
  })

  function updateAnswer<K extends keyof typeof answers>(
    key: K,
    value: number
  ) {
    setAnswers((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const questions = [
    {
      key: "movement",
      question: "How would you describe your usual energy?",
      left: "Calm",
      right: "Energetic",
    },
    {
      key: "roundness",
      question: "How do you usually approach other people?",
      left: "Direct",
      right: "Polite",
    },
    {
      key: "sharpness",
      question: "How do you usually behave in social situations?",
      left: "Introverted",
      right: "Extroverted",
    },
    {
      key: "texture",
      question: "How comfortable are you expressing yourself?",
      left: "Confident",
      right: "Reserved",
    },
    {
      key: "spacing",
      question: "How close do you tend to feel to the people around you?",
      left: "Connected",
      right: "Separated",
    },
    {
      key: "size",
      question: "How much presence do you feel you have in a space?",
      left: "Subtle",
      right: "Noticeable",
    },
  ] as const

  const totalQuestions = questions.length + 1

  function generateShape() {
    const generatedSettings: Settings = {
      ...DEFAULT,
      ...answers,
    }

    onComplete(generatedSettings)
  }

  return (
    <div
      style={{
        height: "100vh",
        overflowY: "auto",
        scrollSnapType: "y mandatory",
        background: "#F5F4F1",
        fontFamily: '"DM Sans", sans-serif',
      }}
    >
      {questions.map(({ key, question, left, right }, index) => (
        <section
          key={key}
          style={{
            height: "100vh",
            scrollSnapAlign: "start",
            scrollSnapStop: "always",
  
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
  
            padding: "40px 24px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 620,
            }}
          >
            {/* Question number */}
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#B4B3AE",
                marginBottom: 18,
              }}
            >
              Question {index + 1} / {totalQuestions}
            </div>
  
            {/* Question */}
            <div
              style={{
                fontSize: 36,
                lineHeight: 1.15,
                fontWeight: 600,
                color: "#1c1c1c",
                letterSpacing: "-0.035em",
                marginBottom: 42,
              }}
            >
              {question}
            </div>
  
            {/* Answer slider */}
            <ShapeSlider
              label=""
              left={left}
              right={right}
              value={answers[key]}
              onChange={(value) => updateAnswer(key, value)}
            />
  
            {/* Scroll hint */}
            {index < questions.length - 1 && (
              <div
                style={{
                  marginTop: 55,
                  fontSize: 11,
                  color: "#B4B3AE",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Scroll to continue ↓
              </div>
            )}
          </div>
        </section>
      ))}

      {/* Color question */}
      <section
        style={{
          height: "100vh",
          scrollSnapAlign: "start",
          scrollSnapStop: "always",

          display: "flex",
          alignItems: "center",
          justifyContent: "center",

          padding: "40px 24px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 620,
          }}
        >
          {/* Question number */}
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#B4B3AE",
              marginBottom: 18,
            }}
          >
            Question {totalQuestions} / {totalQuestions}
          </div>

          {/* Question */}
          <div
            style={{
              fontSize: 36,
              lineHeight: 1.15,
              fontWeight: 600,
              color: "#1c1c1c",
              letterSpacing: "-0.035em",
              marginBottom: 38,
            }}
          >
            Which color represents you best?
          </div>

          <div
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: "#8A8984",
              marginBottom: 30,
            }}
          >
            Choose the color that you feel most connected to.
          </div>

          <ColorWheelPicker
            value={answers.color}
            onChange={(color) =>
              setAnswers((prev) => ({
                ...prev,
                color,
              }))
            }
          />

          <div
            style={{
              marginTop: 45,
              fontSize: 11,
              color: "#B4B3AE",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Scroll to reveal your shape ↓
          </div>
        </div>
      </section>
  
      {/* Final screen */}
      <section
        style={{
          height: "100vh",
          scrollSnapAlign: "start",
          scrollSnapStop: "always",
  
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
  
          padding: "40px 24px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 620,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#B4B3AE",
              marginBottom: 18,
            }}
          >
            Your Identity
          </div>
  
          <div
            style={{
              fontSize: 42,
              lineHeight: 1.1,
              fontWeight: 600,
              color: "#1c1c1c",
              letterSpacing: "-0.04em",
              marginBottom: 16,
            }}
          >
            Your shape is ready.
          </div>
  
          <div
            style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: "#8A8984",
              marginBottom: 40,
            }}
          >
            Your answers will now be translated into your unique 3D shape.
          </div>
  
          <button
            onClick={generateShape}
            style={{
              width: "100%",
              padding: "17px 0",
              borderRadius: 12,
              border: "none",
              background: "#1c1c1c",
              color: "#ffffff",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.12em",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            GENERATE MY SHAPE
          </button>
        </div>
      </section>
    </div>
  )
}

// ─── Projection view (fullscreen black, shape only) ────────────────────────────

function ProjectionView() {
  const [settings, setSettings] = useState<Settings>(loadSettings)

  useEffect(() => {
    // Applies settings received from either localStorage or the Vite WebSocket.
    const applySettings = (incoming: Settings) => {
      const nextSettings = { ...DEFAULT, ...incoming }

      setSettings(nextSettings)

      // Keep a local copy as a fallback.
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings))
      } catch {
        // localStorage unavailable — WebSocket sync still works.
      }
    }

    // Existing browser-tab synchronization remains as a fallback.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return

      try {
        applySettings(JSON.parse(e.newValue))
      } catch {
        // Ignore malformed payloads.
      }
    }

    window.addEventListener("storage", onStorage)

    // Network synchronization.
    // This works even when /projection is running inside TouchDesigner.
    const onRemoteSettings = (incoming: Settings) => {
      applySettings(incoming)
    }

    if (import.meta.hot) {
      import.meta.hot.on("shape-sync:update", onRemoteSettings)

      // Ask the server for the latest existing shape immediately.
      import.meta.hot.send("shape-sync:request")
    }

    return () => {
      window.removeEventListener("storage", onStorage)

      if (import.meta.hot) {
        import.meta.hot.off("shape-sync:update", onRemoteSettings)
      }
    }
  }, [])

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#000",
        overflow: "hidden",
      }}
    >
      <ShapeRenderer settings={settings} background="#000000" />
    </div>
  )
}

// ─── Main view (existing UI) ───────────────────────────────────────────────────

function MainView() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [finished,  setFinished] = useState(false)
  const [webglError, setWebglError] = useState(false)
  const [stage, setStage] = useState<"questions" | "editor">("questions")

// Every time settings change, save locally AND broadcast through Vite's WebSocket.
useEffect(() => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // localStorage is only a fallback.
  }

  // Sends the exact existing Settings object to all projection clients.
  if (import.meta.hot) {
    import.meta.hot.send("shape-sync:update", settings)
  }
}, [settings])

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  if (stage === "questions") {
    return (
      <Questionnaire
        onComplete={(generatedSettings) => {
          setSettings(generatedSettings)
          setStage("editor")
        }}
      />
    )
  }
  
  return (
    <div style={{ display: "flex", height: "100%", fontFamily: '"DM Sans", sans-serif', position: "relative", overflow: "hidden" }}>

      {/* Left: 3D viewport */}
      <div style={{ flex: 1, position: "relative", background: "#F5F4F1" }}>
        <ShapeRenderer settings={settings} background="#F5F4F1" onWebglError={() => setWebglError(true)} />

        {webglError && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#1c1c1c" }}>WebGL unavailable</div>
            <div style={{ fontSize: 12, color: "#B4B3AE", textAlign: "center", maxWidth: 260 }}>
              This browser context does not support WebGL.<br />Try opening the preview in a new tab.
            </div>
          </div>
        )}

        <div style={{ position: "absolute", top: 28, left: 32, fontSize: 13, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "#1c1c1c", opacity: 0.5, userSelect: "none", pointerEvents: "none" }}>
          If you could deconstruct yourself into a shape, what shape would you be?
        </div>
        <div style={{ position: "absolute", bottom: 26, left: 32, display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#B4B3AE", userSelect: "none", pointerEvents: "none" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="#B4B3AE" strokeWidth="1.2"/>
            <path d="M4 7c0-1.66 1.34-3 3-3" stroke="#B4B3AE" strokeWidth="1.2" strokeLinecap="round"/>
            <path d="M7 4l1.2 1.2-1.2 1.2" stroke="#B4B3AE" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Drag to rotate · Scroll to zoom
        </div>
      </div>

      {/* Right: settings panel */}
      <div style={{ width: 308, background: "#fff", borderLeft: "1px solid #ECEAE5", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        <div style={{ padding: "30px 28px 22px", borderBottom: "1px solid #F2F1ED" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#B4B3AE", marginBottom: 7 }}>Personality</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#1c1c1c", letterSpacing: "-0.03em" }}>How do you perceive yourself?</div>
        </div>

        <div
          className="panel-scroll"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "26px 28px 8px",
          }}
        >
          {SLIDER_DEFS.map(({ key, label, left, right }) => (
            <ShapeSlider
              key={key}
              label={label}
              left={left}
              right={right}
              value={settings[key] as number}
              onChange={(v) => update(key, v)}
            />
          ))}

          <ShapeSlider
              label="Quantity"
              left="1"
              right="6"
              value={settings.quantity}
              min={2}
              max={6}
              step={1}
              onChange={(v) => update("quantity", v)}
            />

          <ColorWheelPicker
            value={settings.color}
            onChange={(color) =>
              update("color", color)
            }
          />
        </div>

        <div
          style={{
            padding: "18px 28px 32px",
            borderTop: "1px solid #F2F1ED",
            display: "flex",
            flexDirection: "column",
            gap: 11,
          }}
        >
          <button
            className="btn-finish"
            onClick={() => setFinished(true)}
            style={{
              width: "100%",
              padding: "14px 0",
              borderRadius: 12,
              border: "none",
              background: "#1c1c1c",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.12em",
              color: "#ffffff",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "background 0.14s",
            }}
          >
            FINISH
          </button>
        </div>
      </div>

      {/* Finish overlay */}
      {finished && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(245,244,241,0.90)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: settings.color, marginBottom: 28, boxShadow: "0 8px 32px rgba(0,0,0,0.14)" }} />
          <div style={{ fontSize: 42, fontWeight: 700, color: "#1c1c1c", letterSpacing: "-0.04em", marginBottom: 10, textAlign: "center" }}>Shape saved.</div>
          <div style={{ fontSize: 15, color: "#9A9A95", marginBottom: 36 }}>Your creation is ready for the next step.</div>
          <button onClick={() => setFinished(false)}
            style={{ padding: "13px 36px", borderRadius: 12, border: "1.5px solid #1c1c1c", background: "transparent", fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", color: "#1c1c1c", cursor: "pointer", fontFamily: "inherit" }}>
            CONTINUE EDITING
          </button>
        </div>
      )}
    </div>
  )
}

// ─── App (route dispatcher) ────────────────────────────────────────────────────

export default function App() {
  const isProjection =
    window.location.pathname === "/projection" ||
    new URLSearchParams(window.location.search).get("projection") === "true"

  return isProjection ? <ProjectionView /> : <MainView />
}