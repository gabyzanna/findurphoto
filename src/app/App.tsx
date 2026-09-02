import { useState, useRef, useEffect, useCallback } from "react";
import { Download, Camera, RotateCcw, Zap, Film } from "lucide-react";

const FILTERS = [
  { id: "normal", label: "Natural", css: "none" },
  { id: "bw", label: "Mono", css: "grayscale(1) contrast(1.1)" },
  { id: "sepia", label: "Sepia", css: "sepia(0.8) contrast(1.05)" },
  {
    id: "vivid",
    label: "Vivid",
    css: "saturate(1.9) contrast(1.2) brightness(1.05)",
  },
  {
    id: "cool",
    label: "Cool",
    css: "hue-rotate(195deg) saturate(0.85) brightness(0.95)",
  },
  {
    id: "fade",
    label: "Faded",
    css: "brightness(1.2) contrast(0.78) saturate(0.65)",
  },
  {
    id: "drama",
    label: "Drama",
    css: "contrast(1.6) brightness(0.88) saturate(1.3)",
  },
];

const STRIP_COLORS = [
  { id: "pink", hex: "#ff2d78" },
  { id: "yellow", hex: "#ffd93d" },
  { id: "violet", hex: "#7c3aed" },
  { id: "cyan", hex: "#06b6d4" },
  { id: "cream", hex: "#f5f0e8" },
  { id: "black", hex: "#111111" },
];

const DARK_STRIP_COLORS = new Set([
  "#ff2d78",
  "#7c3aed",
  "#06b6d4",
  "#111111",
]);

const FRAME_COUNT = 4;
const COUNTDOWN_SEC = 3;

type Phase = "idle" | "ready" | "countdown" | "complete";

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [photos, setPhotos] = useState<string[]>([]);
  const [filter, setFilter] = useState("normal");
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC);
  const [flash, setFlash] = useState(false);
  const [stripColor, setStripColor] = useState("#ff2d78");
  const [loading, setLoading] = useState(false);
  const [countdownKey, setCountdownKey] = useState(0);

  // Camera
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState("");

  const filterCSS =
    FILTERS.find((f) => f.id === filter)?.css ?? "none";

  /*
   * ============================================================
   * GET CAMERA LIST
   * ============================================================
   */

  const getCameras = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        return;
      }

      const devices =
        await navigator.mediaDevices.enumerateDevices();

      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput"
      );

      setCameras(videoDevices);

      // Jika belum ada kamera yang dipilih,
      // gunakan kamera pertama.
      if (
        videoDevices.length > 0 &&
        !selectedCamera
      ) {
        setSelectedCamera(
          videoDevices[0].deviceId
        );
      }
    } catch (error) {
      console.error(
        "Gagal mendapatkan daftar kamera:",
        error
      );
    }
  }, [selectedCamera]);

  /*
   * ============================================================
   * START CAMERA
   * ============================================================
   */

  const startCamera = async () => {
    setLoading(true);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Camera API tidak tersedia."
        );
      }

      // Matikan stream lama
      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) => track.stop());

        streamRef.current = null;
      }

      const videoConstraints: MediaTrackConstraints =
        selectedCamera
          ? {
              deviceId: {
                exact: selectedCamera,
              },
              width: {
                ideal: 1280,
              },
              height: {
                ideal: 720,
              },
            }
          : {
              facingMode: "user",
              width: {
                ideal: 1280,
              },
              height: {
                ideal: 720,
              },
            };

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });

      streamRef.current = stream;

      /*
       * Ambil kamera yang sebenarnya sedang digunakan.
       * Ini penting supaya dropdown otomatis mengikuti
       * kamera aktif.
       */
      const activeTrack =
        stream.getVideoTracks()[0];

      const settings =
        activeTrack.getSettings();

      if (settings.deviceId) {
        setSelectedCamera(
          settings.deviceId
        );
      }

      // Masuk ke booth.
      // useEffect akan memasang stream ke video.
      setPhase("ready");

      // Ambil daftar kamera setelah permission diberikan.
      await getCameras();
    } catch (error) {
      console.error(
        "Camera error:",
        error
      );

      if (
        error instanceof DOMException &&
        error.name === "NotAllowedError"
      ) {
        alert(
          "Akses kamera ditolak. Silakan izinkan kamera pada browser."
        );
      } else if (
        error instanceof DOMException &&
        error.name === "NotFoundError"
      ) {
        alert(
          "Kamera tidak ditemukan."
        );
      } else if (
        error instanceof DOMException &&
        error.name === "NotReadableError"
      ) {
        alert(
          "Kamera sedang digunakan oleh aplikasi lain."
        );
      } else if (
        error instanceof DOMException &&
        error.name === "OverconstrainedError"
      ) {
        alert(
          "Kamera yang dipilih tidak dapat digunakan."
        );
      } else {
        alert(
          "Kamera tidak dapat dibuka. Silakan periksa izin kamera."
        );
      }

      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) => track.stop());

        streamRef.current = null;
      }

      setPhase("idle");
    } finally {
      setLoading(false);
    }
  };

  /*
   * ============================================================
   * CONNECT STREAM TO VIDEO
   * ============================================================
   */

  useEffect(() => {
    if (phase === "idle") {
      return;
    }

    const video = videoRef.current;
    const stream = streamRef.current;

    if (!video || !stream) {
      return;
    }

    video.srcObject = stream;

    const playVideo = async () => {
      try {
        await video.play();
      } catch (error) {
        console.error(
          "Video play error:",
          error
        );
      }
    };

    if (video.readyState >= 1) {
      playVideo();
    } else {
      video.onloadedmetadata = () => {
        playVideo();
      };
    }

    return () => {
      video.onloadedmetadata = null;
    };
  }, [phase]);

  /*
   * ============================================================
   * CHANGE CAMERA
   * ============================================================
   */

  const changeCamera = async (
    deviceId: string
  ) => {
    if (!deviceId) {
      return;
    }

    try {
      setSelectedCamera(deviceId);

      // Hentikan kamera sebelumnya
      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) => track.stop());

        streamRef.current = null;
      }

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: {
              exact: deviceId,
            },
            width: {
              ideal: 1280,
            },
            height: {
              ideal: 720,
            },
          },
          audio: false,
        });

      streamRef.current = stream;

      // Pasang stream baru langsung ke video
      if (videoRef.current) {
        videoRef.current.srcObject =
          stream;

        await videoRef.current.play();
      }

      // Update kamera aktif
      const activeTrack =
        stream.getVideoTracks()[0];

      const settings =
        activeTrack.getSettings();

      if (settings.deviceId) {
        setSelectedCamera(
          settings.deviceId
        );
      }

      // Refresh daftar kamera
      await getCameras();
    } catch (error) {
      console.error(
        "Gagal mengganti kamera:",
        error
      );

      alert(
        "Kamera yang dipilih tidak dapat digunakan."
      );
    }
  };

  /*
   * ============================================================
   * CAPTURE PHOTO
   * ============================================================
   */

  const capture = useCallback((): string => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      return "";
    }

    if (
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      return "";
    }

    canvas.width =
      video.videoWidth || 640;

    canvas.height =
      video.videoHeight || 480;

    const ctx =
      canvas.getContext("2d");

    if (!ctx) {
      return "";
    }

    ctx.save();

    if (filterCSS !== "none") {
      ctx.filter = filterCSS;
    }

    // Mirror hasil foto
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    ctx.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.restore();

    return canvas.toDataURL(
      "image/jpeg",
      0.92
    );
  }, [filterCSS]);

  /*
   * ============================================================
   * SHOOT
   * ============================================================
   */

  const shoot = useCallback(async () => {
    if (phase !== "ready") {
      return;
    }

    if (
      !videoRef.current ||
      videoRef.current.readyState < 2
    ) {
      alert(
        "Kamera belum siap. Silakan tunggu sebentar."
      );

      return;
    }

    setPhase("countdown");

    for (
      let i = COUNTDOWN_SEC;
      i >= 1;
      i--
    ) {
      setCountdown(i);

      setCountdownKey(
        (key) => key + 1
      );

      await new Promise(
        (resolve) =>
          setTimeout(resolve, 1000)
      );
    }

    setFlash(true);

    await new Promise(
      (resolve) =>
        setTimeout(resolve, 80)
    );

    const image = capture();

    await new Promise(
      (resolve) =>
        setTimeout(resolve, 150)
    );

    setFlash(false);

    if (!image) {
      setPhase("ready");

      alert(
        "Foto gagal diambil. Silakan coba lagi."
      );

      return;
    }

    setPhotos((previous) => {
      const next = [
        ...previous,
        image,
      ];

      setPhase(
        next.length >= FRAME_COUNT
          ? "complete"
          : "ready"
      );

      return next;
    });
  }, [phase, capture]);

  /*
   * ============================================================
   * RETAKE
   * ============================================================
   */

  const retake = () => {
    setPhotos([]);
    setPhase("ready");
  };

  /*
   * ============================================================
   * EXIT
   * ============================================================
   */

  const exitBooth = () => {
    setPhotos([]);
    setPhase("idle");

    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) => track.stop());

      streamRef.current = null;
    }

    setCameras([]);
    setSelectedCamera("");

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  /*
   * ============================================================
   * DOWNLOAD
   * ============================================================
   */

  const download = async () => {
    const pw = 400;
    const ph = 300;
    const pad = 18;
    const top = 48;
    const bot = 52;

    const stripCanvas =
      document.createElement("canvas");

    stripCanvas.width =
      pw + pad * 2;

    stripCanvas.height =
      top +
      (ph + pad) * FRAME_COUNT +
      bot;

    const ctx =
      stripCanvas.getContext("2d");

    if (!ctx) {
      return;
    }

    ctx.fillStyle = stripColor;

    ctx.fillRect(
      0,
      0,
      stripCanvas.width,
      stripCanvas.height
    );

    await Promise.all(
      photos.map(
        (src, index) =>
          new Promise<void>(
            (resolve) => {
              const image =
                new Image();

              image.onload = () => {
                ctx.drawImage(
                  image,
                  pad,
                  top +
                    index *
                      (ph + pad),
                  pw,
                  ph
                );

                resolve();
              };

              image.onerror = () => {
                resolve();
              };

              image.src = src;
            }
          )
      )
    );

    const isDark =
      DARK_STRIP_COLORS.has(
        stripColor
      );

    ctx.fillStyle = isDark
      ? "rgba(255,255,255,0.55)"
      : "rgba(0,0,0,0.4)";

    ctx.font =
      "bold 12px sans-serif";

    ctx.textAlign = "center";

    ctx.fillText(
      "★  PHOTOBOOTH  ★",
      stripCanvas.width / 2,
      stripCanvas.height - 18
    );

    const link =
      document.createElement("a");

    link.download =
      "photobooth-strip.jpg";

    link.href =
      stripCanvas.toDataURL(
        "image/jpeg",
        0.95
      );

    link.click();
  };

  /*
   * ============================================================
   * CLEANUP
   * ============================================================
   */

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) =>
            track.stop()
          );
      }
    };
  }, []);

  /*
   * ============================================================
   * UI
   * ============================================================
   */

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-hidden">

      {/* HEADER */}

      <header className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">

        <div className="flex items-center gap-2.5">

          <Film
            size={16}
            className="text-primary"
          />

          <span className="font-booth text-base tracking-[0.25em] uppercase">
            Photobooth
          </span>

        </div>

        {phase !== "idle" && (
          <button
            onClick={exitBooth}
            className="text-muted-foreground hover:text-foreground text-xs uppercase tracking-widest flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw size={11} />
            Exit
          </button>
        )}

      </header>

      {/* MAIN */}

      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">

        {phase === "idle" ? (
          <IdleScreen
            onStart={startCamera}
            loading={loading}
          />
        ) : (
          <BoothScreen
            videoRef={videoRef}
            photos={photos}
            phase={phase}
            filter={filter}
            filterCSS={filterCSS}
            countdown={countdown}
            countdownKey={countdownKey}
            flash={flash}
            stripColor={stripColor}
            cameras={cameras}
            selectedCamera={
              selectedCamera
            }
            onCameraChange={
              changeCamera
            }
            onFilterChange={
              setFilter
            }
            onStripColorChange={
              setStripColor
            }
            onShoot={shoot}
            onRetake={retake}
            onDownload={download}
          />
        )}

      </main>

      <canvas
        ref={canvasRef}
        className="hidden"
      />

      <style>{`
        .font-booth {
          font-family: 'Righteous', cursive;
        }

        .font-display {
          font-family: 'Righteous', cursive;
        }

        @keyframes cdpop {
          0% {
            transform:
              scale(1.8)
              translateY(-8px);
            opacity: 0;
          }

          18% {
            opacity: 1;
          }

          72% {
            opacity: 1;
          }

          100% {
            transform:
              scale(0.5)
              translateY(16px);
            opacity: 0;
          }
        }

        .anim-cdpop {
          animation:
            cdpop 0.88s
            cubic-bezier(
              0.22,
              1,
              0.36,
              1
            )
            forwards;
        }

        @keyframes flash-in {
          0% {
            opacity: 0;
          }

          40% {
            opacity: 1;
          }

          100% {
            opacity: 0;
          }
        }

        .anim-flash {
          animation:
            flash-in
            0.25s
            ease-out
            forwards;
        }

        ::-webkit-scrollbar {
          width: 0;
          height: 0;
        }

        * {
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}

/*
 * ================================================================
 * IDLE SCREEN
 * ================================================================
 */

function IdleScreen({
  onStart,
  loading,
}: {
  onStart: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-10 px-6 py-10 relative overflow-hidden select-none">

      {/* LEFT DECORATION */}

      <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-evenly py-4 opacity-10 pointer-events-none">

        {[...Array(12)].map(
          (_, i) => (
            <div
              key={i}
              className="mx-auto w-4 h-3 rounded-full border border-foreground/50"
            />
          )
        )}

      </div>

      {/* RIGHT DECORATION */}

      <div className="absolute right-0 top-0 bottom-0 w-8 flex flex-col justify-evenly py-4 opacity-10 pointer-events-none">

        {[...Array(12)].map(
          (_, i) => (
            <div
              key={i}
              className="mx-auto w-4 h-3 rounded-full border border-foreground/50"
            />
          )
        )}

      </div>

      {/* HERO */}

      <div className="text-center relative z-10">

        <h1
          className="font-display font-black leading-none tracking-tight"
          style={{
            fontSize:
              "clamp(3.5rem, 14vw, 9rem)",
            lineHeight: 0.88,
          }}
        >
          STRIKE
          <br />

          <span className="text-primary">
            A POSE
          </span>
        </h1>

        <p className="text-muted-foreground tracking-[0.22em] text-xs uppercase mt-5">
          4 frames &nbsp;·&nbsp; 1 strip &nbsp;·&nbsp; yours forever
        </p>

      </div>

      {/* SAMPLE STRIPS */}

      <div className="flex gap-5 relative z-10 items-end">

        {[
          {
            color: "#ff2d78",
            rotate: "-3deg",
            offset: "0px",
          },
          {
            color: "#ffd93d",
            rotate: "0deg",
            offset: "-10px",
          },
          {
            color: "#7c3aed",
            rotate: "3.5deg",
            offset: "0px",
          },
        ].map(
          (
            {
              color,
              rotate,
              offset,
            },
            index
          ) => (
            <div
              key={index}
              className="w-14 flex flex-col gap-1 p-1.5 shadow-xl"
              style={{
                backgroundColor:
                  color,
                transform:
                  `rotate(${rotate}) translateY(${offset})`,
                borderRadius: "3px",
              }}
            >
              {[...Array(4)].map(
                (_, i) => (
                  <div
                    key={i}
                    className="w-full bg-black/30"
                    style={{
                      aspectRatio: "4/3",
                      borderRadius:
                        "2px",
                    }}
                  />
                )
              )}
            </div>
          )
        )}

      </div>

      {/* BUTTON */}

      <button
        onClick={onStart}
        disabled={loading}
        className="relative z-10 flex items-center gap-3 bg-primary text-primary-foreground px-12 py-4 font-booth text-base tracking-[0.18em] uppercase hover:bg-primary/90 transition-all duration-150 hover:scale-[1.04] active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed"
        style={{
          borderRadius: "3px",
          boxShadow:
            "0 0 48px rgba(255, 45, 120, 0.28), 0 2px 16px rgba(255, 45, 120, 0.2)",
        }}
      >
        <Camera size={17} />

        {loading
          ? "Starting…"
          : "Open Booth"}
      </button>

      <p className="text-muted-foreground text-[11px] relative z-10 tracking-wider">
        Camera access required
      </p>

    </div>
  );
}

/*
 * ================================================================
 * BOOTH SCREEN
 * ================================================================
 */

interface BoothScreenProps {
  videoRef: React.RefObject<HTMLVideoElement>;

  photos: string[];

  phase: Phase;

  filter: string;

  filterCSS: string;

  countdown: number;

  countdownKey: number;

  flash: boolean;

  stripColor: string;

  cameras: MediaDeviceInfo[];

  selectedCamera: string;

  onCameraChange: (
    deviceId: string
  ) => void;

  onFilterChange: (
    filter: string
  ) => void;

  onStripColorChange: (
    color: string
  ) => void;

  onShoot: () => void;

  onRetake: () => void;

  onDownload: () => void;
}

function BoothScreen({
  videoRef,
  photos,
  phase,
  filter,
  filterCSS,
  countdown,
  countdownKey,
  flash,
  stripColor,
  cameras,
  selectedCamera,
  onCameraChange,
  onFilterChange,
  onStripColorChange,
  onShoot,
  onRetake,
  onDownload,
}: BoothScreenProps) {
  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_210px] overflow-hidden">

      {/* ======================================================
          LEFT
          ====================================================== */}

      <div className="flex flex-col items-center overflow-hidden min-h-0">

        {/* ====================================================
            CAMERA
            1400 x 580
            ==================================================== */}

        <div className="relative w-full max-w-[1400px] h-[580px] shrink-0 bg-black overflow-hidden">

          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{
              filter:
                filterCSS !== "none"
                  ? filterCSS
                  : undefined,

              transform:
                "scaleX(-1)",
            }}
          />

          {/* FLASH */}

          {flash && (
            <div className="anim-flash absolute inset-0 bg-white z-20 pointer-events-none" />
          )}

          {/* COUNTDOWN */}

          {phase === "countdown" && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">

              <span
                key={countdownKey}
                className="font-display anim-cdpop text-white select-none"
                style={{
                  fontSize:
                    "clamp(6rem, 22vw, 14rem)",

                  textShadow:
                    "0 0 60px rgba(255,45,120,0.9), 0 0 120px rgba(255,45,120,0.4)",
                }}
              >
                {countdown}
              </span>

            </div>
          )}

          {/* FRAME PROGRESS */}

          <div className="absolute top-3 left-3 flex gap-2 z-10">

            {[...Array(FRAME_COUNT)].map(
              (_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full border-2 transition-all duration-300 ${
                    i < photos.length
                      ? "border-primary bg-primary"
                      : "border-white/40 bg-transparent"
                  }`}
                />
              )
            )}

          </div>

          {/* COUNTER */}

          <div className="absolute top-3 right-3 font-mono text-white/35 text-xs z-10 tracking-widest">
            {photos.length}/
            {FRAME_COUNT}
          </div>

          {/* COMPLETE */}

          {phase === "complete" && (
            <div className="absolute inset-0 bg-black/40 z-10 flex items-center justify-center">

              <div className="text-center">

                <p
                  className="font-display text-white text-5xl mb-1"
                  style={{
                    textShadow:
                      "0 2px 24px rgba(0,0,0,0.6)",
                  }}
                >
                  Done!
                </p>

                <p className="text-white/55 text-sm tracking-widest uppercase text-xs">
                  Your strip is ready
                </p>

              </div>

            </div>
          )}

        </div>

        {/* ====================================================
            CAMERA SELECTOR
            ==================================================== */}

        <div className="w-full max-w-[1400px] bg-card border-t border-border px-3 py-2 flex items-center gap-3 shrink-0">

          <span className="text-muted-foreground text-[10px] uppercase tracking-[0.18em] shrink-0">
            Camera
          </span>

          <select
            value={selectedCamera}
            onChange={(event) =>
              onCameraChange(
                event.target.value
              )
            }
            className="flex-1 min-w-0 bg-background border border-border text-foreground text-xs px-3 py-2 outline-none cursor-pointer"
            style={{
              borderRadius: "3px",
            }}
          >
            {cameras.length === 0 ? (
              <option value="">
                Camera tidak ditemukan
              </option>
            ) : (
              cameras.map(
                (camera, index) => (
                  <option
                    key={
                      camera.deviceId
                    }
                    value={
                      camera.deviceId
                    }
                  >
                    {camera.label ||
                      `Camera ${
                        index + 1
                      }`}
                  </option>
                )
              )
            )}
          </select>

        </div>

        {/* ====================================================
            FILTER BAR
            ==================================================== */}

        <div className="w-full max-w-[1400px] bg-card border-t border-border px-3 py-2 flex gap-1 overflow-x-auto shrink-0">

          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() =>
                onFilterChange(
                  f.id
                )
              }
              className={`shrink-0 px-3 py-1.5 text-xs font-semibold tracking-wide uppercase transition-all duration-150 ${
                filter === f.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              style={{
                borderRadius: "3px",
              }}
            >
              {f.label}
            </button>
          ))}

        </div>

        {/* ====================================================
            CONTROLS
            ==================================================== */}

        <div className="w-full max-w-[1400px] bg-card border-t border-border px-4 py-3 flex items-center justify-between gap-4 shrink-0">

          {/* STRIP COLORS */}

          <div className="flex items-center gap-2.5 shrink-0">

            <span className="text-muted-foreground text-[10px] uppercase tracking-[0.18em] hidden sm:block">
              Strip
            </span>

            <div className="flex gap-1.5">

              {STRIP_COLORS.map(
                (sc) => (
                  <button
                    key={sc.id}
                    onClick={() =>
                      onStripColorChange(
                        sc.hex
                      )
                    }
                    title={sc.id}
                    className="w-4 h-4 rounded-full transition-all hover:scale-110"
                    style={{
                      backgroundColor:
                        sc.hex,

                      border:
                        "1.5px solid rgba(255,255,255,0.15)",

                      outline:
                        stripColor ===
                        sc.hex
                          ? "2px solid white"
                          : "none",

                      outlineOffset:
                        "2px",

                      transform:
                        stripColor ===
                        sc.hex
                          ? "scale(1.2)"
                          : undefined,
                    }}
                  />
                )
              )}

            </div>

          </div>

          {/* ACTION */}

          {phase === "complete" ? (
            <div className="flex gap-2">

              <button
                onClick={onRetake}
                className="flex items-center gap-1.5 px-4 py-2 border border-border text-xs font-semibold uppercase tracking-wider hover:bg-muted transition-colors"
                style={{
                  borderRadius: "3px",
                }}
              >
                <RotateCcw
                  size={11}
                />

                Retake
              </button>

              <button
                onClick={onDownload}
                className="flex items-center gap-1.5 px-5 py-2 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
                style={{
                  borderRadius: "3px",

                  boxShadow:
                    "0 0 20px rgba(255,45,120,0.35)",
                }}
              >
                <Download
                  size={11}
                />

                Download
              </button>

            </div>
          ) : (
            <button
              onClick={onShoot}
              disabled={
                phase !== "ready"
              }
              className={`flex items-center gap-2 px-7 py-2.5 text-xs font-bold uppercase tracking-[0.15em] transition-all duration-150 ${
                phase === "ready"
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 active:scale-95"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
              style={{
                borderRadius: "3px",

                boxShadow:
                  phase === "ready"
                    ? "0 0 20px rgba(255,45,120,0.28)"
                    : undefined,
              }}
            >
              <Zap size={12} />

              {phase ===
              "countdown"
                ? `${countdown}…`
                : `Shoot ${
                    photos.length + 1
                  } of ${
                    FRAME_COUNT
                  }`}
            </button>
          )}

        </div>

      </div>

      {/* ======================================================
          RIGHT — PREVIEW
          ====================================================== */}

      <div className="border-l border-border bg-card flex min-h-0 flex-col overflow-hidden">

        {/* HEADER */}

        <div className="px-4 py-2.5 border-b border-border shrink-0">

          <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Preview
          </span>

        </div>

        {/* CONTENT */}

        <div className="flex-1 min-h-0 p-3 flex flex-col overflow-hidden">

          {/* FILM STRIP */}

          <div
            className="flex-1 flex flex-col gap-[6px] p-[7px] min-h-0 transition-colors duration-300"
            style={{
              backgroundColor:
                stripColor,

              borderRadius: "3px",
            }}
          >

            {[...Array(FRAME_COUNT)].map(
              (_, i) => (
                <div
                  key={i}
                  className="flex-1 min-h-0 overflow-hidden bg-black/20"
                  style={{
                    borderRadius:
                      "2px",
                  }}
                >
                  {photos[i] ? (
                    <img
                      src={photos[i]}
                      alt={`Frame ${
                        i + 1
                      }`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">

                      <span className="text-white/20 font-mono text-xs">
                        {i + 1}
                      </span>

                    </div>
                  )}
                </div>
              )
            )}

          </div>

          {/* LABEL */}

          <div className="text-center mt-2 shrink-0">

            <span className="font-booth text-[9px] tracking-[0.3em] uppercase text-muted-foreground">
              photobooth
            </span>

          </div>

        </div>

      </div>

    </div>
  );
}