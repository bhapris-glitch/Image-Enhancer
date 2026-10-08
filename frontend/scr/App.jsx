import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles, Box, SlidersHorizontal, FolderOpen, History, Settings,
  Crown, UserCircle2, ChevronDown, UploadCloud, X, ZoomIn, ZoomOut,
  Maximize, ChevronRight, ChevronDown as Down, Check, Zap, Cpu,
  Download, Image as ImageIcon, Loader2, SunMedium
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const PRESETS = {
  "Original": { width: null, height: null },
  "2K": { width: 2048, height: 1152 },
  "4K": { width: 3840, height: 2160 },
  "8K": { width: 7680, height: 4320 }
};

function formatBytes(bytes) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}

function App() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [originalUrl, setOriginalUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [resultBlob, setResultBlob] = useState(null);
  const [preset, setPreset] = useState("8K");
  const [imageType, setImageType] = useState("General");
  const [format, setFormat] = useState("jpg");
  const [quality, setQuality] = useState(95);
  const [autoEnhance, setAutoEnhance] = useState(true);
  const [sharpen, setSharpen] = useState(true);
  const [denoise, setDenoise] = useState(true);
  const [detailRecovery, setDetailRecovery] = useState(true);
  const [compare, setCompare] = useState(50);
  const [zoom, setZoom] = useState(100);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [advanced, setAdvanced] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, []);

  const dimensions = useMemo(() => {
    if (!file) return null;
    return `${file._width || "—"} × ${file._height || "—"}`;
  }, [file]);

  async function acceptFile(selected) {
    if (!selected) return;
    if (!selected.type.startsWith("image/")) {
      setError("Please upload a JPG, PNG, WEBP, TIFF or compatible image.");
      return;
    }
    if (selected.size > 50 * 1024 * 1024) {
      setError("Maximum upload size is 50 MB.");
      return;
    }
    setError("");
    setResultUrl("");
    setResultBlob(null);

    const url = URL.createObjectURL(selected);
    const img = new Image();
    img.onload = () => {
      selected._width = img.naturalWidth;
      selected._height = img.naturalHeight;
      setFile(selected);
      setOriginalUrl(url);
    };
    img.src = url;
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    acceptFile(e.dataTransfer.files?.[0]);
  }

  async function enhance() {
    if (!file) {
      setError("Upload an image first.");
      return;
    }

    setBusy(true);
    setError("");
    setStatus("Preparing AI enhancement…");

    try {
      const body = new FormData();
      body.append("file", file);
      body.append("target", preset);
      body.append("output_format", format);
      body.append("quality", String(quality));
      body.append("auto_enhance", String(autoEnhance));
      body.append("sharpen", String(sharpen));
      body.append("denoise", String(denoise));
      body.append("detail_recovery", String(detailRecovery));
      body.append("image_type", imageType);

      setStatus(preset === "8K"
        ? "Upscaling to 8K and recovering detail…"
        : `Upscaling to ${preset}…`);

      const response = await fetch(`${API_URL}/api/enhance`, {
        method: "POST",
        body
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Enhancement failed.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setResultBlob(blob);
      setResultUrl(url);
      setStatus("Enhancement complete.");
    } catch (e) {
      setError(e.message || "Unable to enhance image.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `layboka-enhanced-${preset.toLowerCase()}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const displayedAfter = resultUrl || originalUrl;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Sparkles size={22}/></div>
          <span>Layboka</span>
          <i />
          <small>AI Image Studio</small>
        </div>
        <div className="top-actions">
          <button className="plan-btn"><Crown size={15}/> Pro Plan</button>
          <button className="account-btn"><UserCircle2 size={31}/><span>My Account</span><ChevronDown size={15}/></button>
        </div>
      </header>

      <aside className="sidebar">
        <nav>
          <NavItem active icon={<Sparkles/>} text="AI Image Enhancer"/>
          <NavItem icon={<Box/>} text="Product Staging"/>
          <NavItem icon={<SlidersHorizontal/>} text="Professional Editor"/>
          <NavItem icon={<FolderOpen/>} text="My Projects"/>
          <NavItem icon={<History/>} text="History"/>
          <NavItem icon={<Settings/>} text="Settings"/>
        </nav>

        <div className="upgrade-card">
          <div className="upgrade-icon"><Zap size={19}/></div>
          <strong>Unlock 8K Quality</strong>
          <p>Get ultra-high resolution with AI enhancement.</p>
          <button>Upgrade to Pro</button>
        </div>

        <div className="powered">
          <Cpu size={23}/>
          <div><span>Powered by Advanced AI</span><b>8K · 4K · 2K</b></div>
        </div>
      </aside>

      <main className="main">
        <section className="page-heading">
          <div className="heading-icon"><Sparkles/></div>
          <div>
            <h1>AI Image Enhancer</h1>
            <p>Upscale, sharpen and bring your images to life with AI. Get crystal clear quality up to 8K resolution.</p>
          </div>
        </section>

        <div className="workspace">
          <section className="left-column">
            <div className="upload-card">
              <div
                className={`dropzone ${dragging ? "dragging" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
              >
                <UploadCloud size={43}/>
                <strong>Drag & drop your image here</strong>
                <span>or click to browse</span>
                <small>Supports JPG, PNG, WEBP (Max 50MB)</small>
                <input
                  ref={inputRef}
                  hidden
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/tiff"
                  onChange={(e) => acceptFile(e.target.files?.[0])}
                />
              </div>

              {file && (
                <div className="file-card">
                  <img src={originalUrl} alt="" />
                  <div>
                    <strong>{file.name}</strong>
                    <span>{formatBytes(file.size)} · {dimensions}</span>
                  </div>
                  <button onClick={() => { setFile(null); setOriginalUrl(""); setResultUrl(""); setResultBlob(null); }}><X/></button>
                </div>
              )}
            </div>

            <div className="preview-card">
              {!file ? (
                <div className="empty-preview">
                  <ImageIcon size={50}/>
                  <strong>Your enhanced preview will appear here</strong>
                  <span>Upload an image to begin.</span>
                </div>
              ) : (
                <>
                  <div className="comparison">
                    <img className="base-image" src={originalUrl} alt="Original" />
                    <div className="after-clip" style={{ width: `${compare}%` }}>
                      <img src={displayedAfter} alt="Enhanced" />
                    </div>
                    <div className="compare-line" style={{ left: `${compare}%` }}>
                      <div className="compare-handle">‹›</div>
                    </div>
                    <span className="badge before">Before</span>
                    <span className="badge after">After {preset}</span>
                  </div>
                  <input
                    className="compare-range"
                    type="range"
                    min="0"
                    max="100"
                    value={compare}
                    onChange={(e) => setCompare(Number(e.target.value))}
                  />
                  <div className="preview-toolbar">
                    <div>
                      <button onClick={() => setZoom(Math.max(25, zoom - 25))}><ZoomOut size={16}/></button>
                      <span>{zoom}%</span>
                      <button onClick={() => setZoom(Math.min(200, zoom + 25))}><ZoomIn size={16}/></button>
                    </div>
                    <button onClick={() => setZoom(100)}><Maximize size={16}/></button>
                  </div>
                </>
              )}
            </div>

            <div className="preview-bottom">
              <div>
                <h3>Enhancement Preview</h3>
                <div className="preset-strip">
                  {["Original", "2K", "4K", "8K"].map((p) => (
                    <button key={p} className={preset === p ? "selected" : ""} onClick={() => setPreset(p)}>
                      <div className="thumb">
                        {file ? <img src={p === "Original" || !resultUrl ? originalUrl : resultUrl} alt="" /> : <ImageIcon/>}
                        {p === "8K" && <Crown size={12}/>}
                      </div>
                      <span>{p}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="quality-card">
                <h3>{preset} Resolution <Crown size={15}/></h3>
                <p><Check/> Ultra HD upscaling</p>
                <p><Check/> Sharpen & detail recovery</p>
                <p><Check/> Noise reduction</p>
                <p><Check/> AI enhancement</p>
              </div>
            </div>
          </section>

          <aside className="settings-panel">
            <h2><SunMedium size={20}/> Enhancement Settings</h2>

            <label className="label">Upscale Resolution</label>
            <div className="resolution-grid">
              {["2K", "4K", "8K"].map((p) => (
                <button key={p} className={preset === p ? "active" : ""} onClick={() => setPreset(p)}>
                  <b>{p}</b>
                  <span>{p === "2K" ? "2048 × 1152" : p === "4K" ? "3840 × 2160" : "7680 × 4320"}</span>
                  {p === "8K" && <Crown size={12}/>}
                </button>
              ))}
            </div>

            <label className="label">AI Features</label>
            <Toggle label="Auto Enhance" value={autoEnhance} setValue={setAutoEnhance}/>
            <Toggle label="Sharpen" value={sharpen} setValue={setSharpen}/>
            <Toggle label="Denoise" value={denoise} setValue={setDenoise}/>
            <Toggle label="Detail Recovery" value={detailRecovery} setValue={setDetailRecovery}/>

            <label className="label">Image Type</label>
            <div className="type-grid">
              {["General", "Portrait", "Landscape", "Product"].map((t) => (
                <button key={t} className={imageType === t ? "active" : ""} onClick={() => setImageType(t)}>{t}</button>
              ))}
            </div>

            <button className="enhance-btn" disabled={busy || !file} onClick={enhance}>
              {busy ? <><Loader2 className="spin"/> Enhancing…</> : <><Sparkles/> Enhance Image <ChevronRight/></>}
            </button>

            {status && <div className="status">{status}</div>}
            {error && <div className="error">{error}</div>}

            <div className="advanced">
              <button onClick={() => setAdvanced(!advanced)}><strong>Advanced Options</strong>{advanced ? <Down/> : <ChevronRight/>}</button>
              {advanced && (
                <div className="advanced-content">
                  <label className="label">Output Format</label>
                  <div className="format-grid">
                    {["jpg", "png", "webp", "tiff"].map((f) => (
                      <button key={f} className={format === f ? "active" : ""} onClick={() => setFormat(f)}>{f.toUpperCase()}</button>
                    ))}
                  </div>
                  <label className="label quality-label">Quality <b>{quality}%</b></label>
                  <input type="range" min="60" max="100" value={quality} onChange={(e) => setQuality(Number(e.target.value))}/>
                  <button className="more-settings">More Settings <ChevronRight/></button>
                  {resultUrl && <button className="download-btn" onClick={download}><Download size={18}/> Download {preset}</button>}
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, text, active }) {
  return <button className={`nav-item ${active ? "active" : ""}`}>{React.cloneElement(icon, { size: 20 })}<span>{text}</span></button>;
}

function Toggle({ label, value, setValue }) {
  return (
    <div className="toggle-row">
      <span>{label}</span>
      <button className={`toggle ${value ? "on" : ""}`} onClick={() => setValue(!value)}><i/></button>
    </div>
  );
}

export default App;
