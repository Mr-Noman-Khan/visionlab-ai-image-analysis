import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowUpRight, CheckCircle2, ChevronDown, Clock3, Cpu,
  FileImage, ImagePlus, Layers3, ScanSearch, ShieldCheck, Sparkles,
  UploadCloud, X, Zap
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function App() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [confidence, setConfidence] = useState(35);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [apiStatus, setApiStatus] = useState("checking");
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/health`)
      .then((res) => {
        if (!res.ok) throw new Error("API unavailable");
        return res.json();
      })
      .then(() => alive && setApiStatus("online"))
      .catch(() => alive && setApiStatus("offline"));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const counts = useMemo(() => {
    if (!result?.detections) return [];
    const grouped = new Map();
    result.detections.forEach((d) => grouped.set(d.label, (grouped.get(d.label) || 0) + 1));
    return [...grouped.entries()].sort((a, b) => b[1] - a[1]);
  }, [result]);

  function acceptFile(candidate) {
    setError("");
    setResult(null);
    if (!candidate) return;
    if (!ACCEPTED.includes(candidate.type)) {
      setError("Please choose a JPG, PNG, or WEBP image.");
      return;
    }
    if (candidate.size > MAX_BYTES) {
      setError("This image is larger than 10 MB. Choose a smaller file.");
      return;
    }
    setFile(candidate);
  }

  async function analyse() {
    if (!file) {
      setError("Upload an image first, then run the analysis.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    const body = new FormData();
    body.append("file", file);
    body.append("confidence", String(confidence / 100));
    try {
      const response = await fetch(`${API_BASE}/api/detect`, { method: "POST", body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || `Request failed (${response.status}).`);
      setResult(data);
    } catch (err) {
      setError(err.message || "Could not reach the backend. Check that FastAPI is running on port 8000.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="VisionLab home">
          <span className="brand-mark"><ScanSearch size={21} strokeWidth={2.2} /></span>
          <span>vision<span className="brand-light">lab</span><span className="brand-dot">.</span></span>
        </a>
        <nav className="nav-links">
          <a className="nav-active" href="#workspace">Workspace</a>
          <a href="#how-it-works">How it works</a>
          <a href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer">API docs <ArrowUpRight size={13} /></a>
        </nav>
        <div className={`api-pill ${apiStatus}`}><span className="status-dot" />{apiStatus === "online" ? "API connected" : apiStatus === "checking" ? "Connecting…" : "API offline"}</div>
      </header>

      <main>
        <section className="hero">
          <div className="eyebrow"><span className="eyebrow-line" /> COMPUTER VISION WORKSPACE</div>
          <h1>Find objects<br /><span className="gradient-text">in your images.</span></h1>
          <p className="hero-copy">Upload an image to see what YOLO detects. Review the labels, confidence scores, and bounding boxes, then adjust the threshold to change which detections appear.</p>
          <div className="hero-tags">
            <span><Zap size={14} /> YOLO object detection</span>
            <span><Layers3 size={14} /> Detection results</span>
            <span><ShieldCheck size={14} /> Local processing</span>
          </div>
        </section>

        <section className="workspace" id="workspace">
          <div className="section-heading">
            <div><span className="section-kicker">01 / INPUT</span><h2>Image workspace</h2></div>
            <span className="subtle-label"><span className="tiny-live" /> LOCAL ANALYSIS</span>
          </div>
          <div className="workspace-grid">
            <section className="panel upload-panel">
              <div className="panel-head">
                <div className="panel-icon"><FileImage size={18} /></div>
                <div><h3>Source image</h3><p>Choose an image to inspect</p></div>
                {file && <button className="icon-button" onClick={reset} title="Remove image" aria-label="Remove image"><X size={17} /></button>}
              </div>
              {!file ? (
                <div
                  className={`dropzone ${dragging ? "dragging" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); acceptFile(e.dataTransfer.files?.[0]); }}
                  onClick={() => inputRef.current?.click()}
                  role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
                >
                  <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => acceptFile(e.target.files?.[0])} />
                  <div className="upload-illustration"><UploadCloud size={28} /></div>
                  <strong>Drop an image here</strong>
                  <span>or <button className="text-button" type="button" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>browse files</button></span>
                  <small>JPG, PNG or WEBP · up to 10 MB</small>
                </div>
              ) : (
                <div className="source-preview">
                  <img src={preview} alt="Selected source" />
                  <div className="file-chip"><FileImage size={15} /><span>{file.name}</span><small>{formatBytes(file.size)}</small></div>
                  <button className="replace-button" onClick={() => inputRef.current?.click()}>Replace image</button>
                  <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => acceptFile(e.target.files?.[0])} />
                </div>
              )}
              <div className="control-block">
                <div className="control-label"><label htmlFor="confidence">Confidence threshold</label><strong>{confidence}%</strong></div>
                <input id="confidence" type="range" min="5" max="95" step="5" value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} />
                <div className="range-ends"><span>More detections</span><span>Higher certainty</span></div>
              </div>
              <button className="primary-button" onClick={analyse} disabled={!file || busy}>
                {busy ? <><span className="spinner" /> Analysing image…</> : <><Sparkles size={17} /> Analyse image <ArrowUpRight size={16} /></>}
              </button>
              {error && <div className="error-message" role="alert"><span>!</span>{error}</div>}
              {apiStatus === "offline" && <p className="helper-warning">The backend is not responding. Start the FastAPI server, then refresh this page.</p>}
            </section>

            <section className="panel result-panel">
              <div className="panel-head">
                <div className="panel-icon purple"><ScanSearch size={18} /></div>
                <div><h3>Detection preview</h3><p>Objects identified in your image</p></div>
                <span className="preview-badge">{result ? "ANALYSIS READY" : "AWAITING INPUT"}</span>
              </div>
              <div className={`result-canvas ${result ? "has-result" : ""}`}>
                {result ? (
                  <img src={result.annotated_image} alt="Image with detected object bounding boxes" />
                ) : file ? (
                  <img className="unprocessed-image" src={preview} alt="Image awaiting analysis" />
                ) : (
                  <div className="canvas-empty">
                    <div className="canvas-orbit orbit-one" /><div className="canvas-orbit orbit-two" />
                    <div className="scan-icon"><ScanSearch size={31} /></div>
                    <strong>Your results will appear here</strong>
                    <span>Upload an image and run the detector</span>
                  </div>
                )}
                {busy && <div className="processing-overlay"><span className="spinner large" /><strong>Finding objects</strong><small>Running the detection model</small></div>}
              </div>
              <div className="canvas-footer">
                <span><span className="legend-box" /> Bounding boxes</span>
                <span><span className="legend-dot" /> Class label + confidence</span>
                {result && <span className="detected-count">{result.detection_count} detected</span>}
              </div>
            </section>
          </div>
        </section>

        <section className="metrics-section" aria-live="polite">
          <div className="section-heading">
            <div><span className="section-kicker">02 / INSIGHTS</span><h2>Analysis overview</h2></div>
            <span className="muted-note">{result ? "Updated just now" : "Your metrics will populate after analysis"}</span>
          </div>
          <div className="metric-grid">
            <Metric icon={<ScanSearch size={17} />} label="Objects found" value={result ? result.detection_count : "—"} detail={result ? `${counts.length} unique classes` : "Awaiting analysis"} />
            <Metric icon={<Clock3 size={17} />} label="Processing time" value={result ? `${result.processing_ms} ms` : "—"} detail={result ? "Model inference + post-processing" : "Inference duration"} />
            <Metric icon={<Cpu size={17} />} label="Detection model" value={result ? result.model : "YOLOv8n"} detail="Lightweight pretrained model" compact />
            <Metric icon={<Activity size={17} />} label="Mean confidence" value={result?.detections?.length ? `${(result.detections.reduce((s, d) => s + d.confidence, 0) / result.detections.length * 100).toFixed(1)}%` : "—"} detail={result?.detections?.length ? "Across detected objects" : "No detections yet"} />
          </div>
        </section>

        <section className="details-grid">
          <div className="panel detections-panel">
            <div className="panel-head">
              <div className="panel-icon"><Layers3 size={18} /></div>
              <div><h3>Detected objects</h3><p>Ranked by confidence score</p></div>
              <span className="count-pill">{result?.detections?.length ?? 0}</span>
            </div>
            {!result ? (
              <div className="table-empty"><div className="empty-small-icon"><ScanSearch size={19} /></div><span>Run an analysis to see the object list.</span></div>
            ) : result.detections.length === 0 ? (
              <div className="table-empty"><div className="empty-small-icon"><ScanSearch size={19} /></div><span>No objects passed this confidence threshold. Try lowering it.</span></div>
            ) : (
              <div className="detections-list">
                {result.detections.map((item, index) => (
                  <div className="detection-row" key={`${item.label}-${index}`}>
                    <div className="row-index">{String(index + 1).padStart(2, "0")}</div>
                    <div className="object-name"><span className="object-dot" /><strong>{item.label}</strong><small>{Math.round(item.box.x2 - item.box.x1)} × {Math.round(item.box.y2 - item.box.y1)} px</small></div>
                    <div className="confidence-cell"><div className="confidence-track"><span style={{ width: `${item.confidence_percent}%` }} /></div><strong>{item.confidence_percent}%</strong></div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="panel summary-panel">
            <div className="panel-head">
              <div className="panel-icon purple"><Activity size={18} /></div>
              <div><h3>Scene summary</h3><p>A quick overview of the output</p></div>
            </div>
            {result ? (
              <div className="summary-content">
                <div className="summary-number">{result.detection_count}<span> objects</span></div>
                <p>{result.detection_count === 0 ? "The model did not find any objects above the selected confidence threshold." : `The model identified ${result.detection_count} object${result.detection_count === 1 ? "" : "s"} across ${counts.length} ${counts.length === 1 ? "class" : "classes"} in this image.`}</p>
                {counts.length > 0 && <div className="class-chips">{counts.map(([name, count]) => <span key={name}>{name}<b>×{count}</b></span>)}</div>}
                <div className="summary-foot"><CheckCircle2 size={15} /> Analysis completed successfully</div>
              </div>
            ) : (
              <div className="summary-placeholder">
                <div className="summary-skeleton wide" /><div className="summary-skeleton" /><div className="summary-skeleton short" />
                <p>Class counts and a compact scene summary will appear here after the image is analysed.</p>
              </div>
            )}
          </div>
        </section>

        <section className="how-section" id="how-it-works">
          <div className="section-heading">
            <div><span className="section-kicker">03 / PIPELINE</span><h2>From pixels to predictions</h2></div>
          </div>
          <div className="pipeline">
            <PipelineStep number="01" icon={<ImagePlus size={20} />} title="Upload" text="Select a local image to analyse." />
            <div className="pipeline-connector" />
            <PipelineStep number="02" icon={<Cpu size={20} />} title="Infer" text="YOLO predicts object classes and boxes." />
            <div className="pipeline-connector" />
            <PipelineStep number="03" icon={<Activity size={20} />} title="Inspect" text="Review confidence, labels and timing." />
          </div>
        </section>
      </main>

      <footer className="footer">
        <a className="brand footer-brand" href="#"><span className="brand-mark"><ScanSearch size={18} /></span><span>vision<span className="brand-light">lab</span><span className="brand-dot">.</span></span></a>
        <span>Built to explore computer vision, one image at a time.</span>
        <span className="footer-tech">React <b>·</b> FastAPI <b>·</b> YOLO</span>
      </footer>
    </div>
  );
}

function Metric({ icon, label, value, detail, compact = false }) {
  return <div className="metric-card"><div className="metric-top"><span className="metric-icon">{icon}</span><span>{label}</span></div><strong className={compact ? "compact-value" : ""}>{value}</strong><small>{detail}</small></div>;
}
function PipelineStep({ number, icon, title, text }) {
  return <div className="pipeline-step"><span className="pipeline-number">{number}</span><div className="pipeline-icon">{icon}</div><strong>{title}</strong><p>{text}</p></div>;
}
