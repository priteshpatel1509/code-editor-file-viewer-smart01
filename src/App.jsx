import React, { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import Editor from "@monaco-editor/react";
import JSZip from "jszip";

function App() {
  const [type, setType] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [output, setOutput] = useState("");
  const [fileName, setFileName] = useState("");
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [zipFiles, setZipFiles] = useState([]);

  // --- ADDED: TOGGLE STATE (SET TO FALSE BY DEFAULT) ---
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // IMAGE EDITING STATES
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [grayscale, setGrayscale] = useState(0);
  const [hue, setHue] = useState(0);
  const [isCropping, setIsCropping] = useState(false);
  const [cropUnit, setCropUnit] = useState("px");
  const [cropData, setCropData] = useState({ x: 0, y: 0, width: 200, height: 200 });
  const [exportFormat, setExportFormat] = useState("image/png");

  const mediaRef = useRef(null);
  const imageDisplayRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const audioCtxRef = useRef(null);

  // --- AUDIO VISUALIZER LOGIC ---
  const startVisualizer = () => {
    if (!mediaRef.current || !canvasRef.current) return;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioCtxRef.current.createAnalyser();
      const source = audioCtxRef.current.createMediaElementSource(mediaRef.current);
      source.connect(analyser);
      analyser.connect(audioCtxRef.current.destination);
      analyser.fftSize = 256;
      audioCtxRef.current.analyser = analyser;
    }
    const analyser = audioCtxRef.current.analyser;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const ctx = canvasRef.current.getContext("2d");

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      const barWidth = (canvasRef.current.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 1.5;
        ctx.fillStyle = "rgb(56, 189, 248)";
        ctx.fillRect(x, canvasRef.current.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };
    draw();
  };

  const handleAudioPlay = () => {
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    startVisualizer();
  };

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animationRef.current);
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    };
  }, [url]);

  // --- UNIVERSAL FILE OPENER ---
  const openFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    const fileType = file.type;
    const extension = file.name.split('.').pop().toLowerCase();

    // Reset states
    setType("");
    setContent("");
    setUrl("");
    setOutput("");
    setZipFiles([]);
    setBrightness(100);
    setContrast(100);
    setGrayscale(0);
    setHue(0);
    setIsCropping(false);
    setPlaybackSpeed(1);

    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }

    // 1. IMAGES
    if (fileType.startsWith("image") || extension === "svg") {
      setType("image");
      setUrl(URL.createObjectURL(file));
    }
    // 2. VIDEO
    else if (fileType.startsWith("video")) {
      setType("video");
      setUrl(URL.createObjectURL(file));
    }
    // 3. AUDIO
    else if (fileType.startsWith("audio")) {
      setType("audio");
      setUrl(URL.createObjectURL(file));
    }
    // 4. PDF
    else if (fileType === "application/pdf" || extension === "pdf") {
      setType("pdf");
      setUrl(URL.createObjectURL(file));
    }
    // 5. ZIP
    else if (extension === "zip") {
      const zip = await JSZip.loadAsync(file);
      const files = Object.keys(zip.files).map(name => ({ name, dir: zip.files[name].dir }));
      setZipFiles(files);
      setType("archive");
    }
    // 6. EXCEL/CSV
    else if (["xlsx", "xls", "csv"].includes(extension)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        setContent(XLSX.utils.sheet_to_json(sheet, { header: 1 }).map(row => row.join("\t")).join("\n"));
        setType("text");
      };
      reader.readAsArrayBuffer(file);
    }
    // 7. 3D MODELS
    else if (["stl", "obj", "glb", "gltf"].includes(extension)) {
      setType("3d");
      setContent(`3D Model Rendering Engine Initializing for: ${extension}`);
    }
    // 8. DATABASE
    else if (["sql", "sqlite", "db", "json"].includes(extension)) {
      const text = await file.text();
      setType("code");
      setContent(text);
      setLanguage(extension === "json" ? "json" : "sql");
    }
    // 9. WORD
    else if (extension === "docx") {
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      setType("text");
      setContent(result.value);
    }
    // 10. CODE / TEXT
    else if (fileType.startsWith("text/") || ["js", "py", "java", "c", "cpp", "html", "css", "md", "xml", "php", "rb", "go", "rs", "swift"].includes(extension)) {
      const text = await file.text();
      setType("code");
      setContent(text);
      const langMap = { py: 'python', java: 'java', html: 'html', css: 'css', md: 'markdown', rs: 'rust' };
      setLanguage(langMap[extension] || "javascript");
    }
    // 11. FALLBACK
    else {
      const buffer = await file.arrayBuffer();
      const view = new Uint8Array(buffer.slice(0, 5000));
      let hex = "";
      for (let i = 0; i < view.length; i++) {
        hex += view[i].toString(16).padStart(2, '0').toUpperCase() + (i % 16 === 15 ? "\n" : " ");
      }
      setType("unknown");
      setContent(hex);
    }
  };

  const runCode = async () => {
    setOutput("Executing process...");
    if (["html", "css", "javascript"].includes(language)) {
      const iframe = document.getElementById("preview");
      const srcDoc = `
        <html>
          <head><style>body{font-family:sans-serif;padding:15px;}${language === "css" ? content : ""}</style></head>
          <body>
            ${language === "html" ? content : ""}
            <script>
              try {
                ${language === "javascript" ? content : ""}
              } catch(err) {
                document.body.innerHTML += "<pre style='color:red'>" + err + "</pre>";
              }
            </script>
          </body>
        </html>`;
      iframe.srcdoc = srcDoc;
      setOutput("Success: Rendered.");
      return;
    }
    try {
      const response = await fetch("https://emkc.org/api/v2/piston/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, version: "*", files: [{ content }] })
      });
      const data = await response.json();
      setOutput(data.run.output || "Finished.");
    } catch (e) {
      setOutput("API Error.");
    }
  };

  const imageFilterStyle = `brightness(${brightness}%) contrast(${contrast}%) grayscale(${grayscale}%) hue-rotate(${hue}deg)`;

  const downloadImage = () => {
    const canvas = document.createElement("canvas");
    const img = document.getElementById("studio-img");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.filter = imageFilterStyle;
    ctx.drawImage(img, 0, 0);
    const link = document.createElement("a");
    link.download = `edited_${fileName.split('.')[0]}.${exportFormat.split('/')[1]}`;
    link.href = canvas.toDataURL(exportFormat);
    link.click();
  };

  const QuickUpload = ({ label, accept, color }) => (
    <label style={{
      background: color, color: "white", padding: "8px 15px", borderRadius: "6px",
      cursor: "pointer", fontSize: "0.85rem", fontWeight: "bold", border: "1px solid rgba(255,255,255,0.1)"
    }}>
      {label}
      <input type="file" accept={accept} hidden onChange={(e) => {
        if (e.target.files[0]) openFile(e.target.files[0]);
        e.target.value = null;
      }} />
    </label>
  );

  return (
    <div style={{ background: "#020617", minHeight: "100vh", width: "100vw", color: "#f8fafc", fontFamily: "sans-serif", display: "flex", flexDirection: "column", overflowX: "hidden" }}>
      <header style={{ width: "100%", background: "#1e293b", padding: "20px 0", textAlign: "center", borderBottom: "1px solid #475569" }}>
        <h1 style={{ margin: "0 0 10px 0", fontSize: "2.5rem", fontWeight: "800" }}>UniView Studio Pro</h1>

        {/* --- TOGGLE BUTTON --- */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          style={{ marginBottom: "15px", background: "#475569", color: "white", border: "none", padding: "5px 15px", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}
        >
          {isMenuOpen ? "Hide Tools ▲" : "Show Tools ▼"}
        </button>

        <div style={{ marginBottom: "15px" }}>
          <label style={{ background: "#2563eb", color: "white", padding: "12px 40px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "1.1rem", display: "inline-block" }}>
            📁 Upload Any File
            <input type="file" hidden onChange={(e) => {
              if (e.target.files[0]) openFile(e.target.files[0]);
              e.target.value = null;
            }} />
          </label>
        </div>

        {/* --- CONDITIONAL RENDERING WRAPPER --- */}
        {isMenuOpen && (
          <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap", padding: "0 20px" }}>
            <QuickUpload label="🖼️ Image" accept="image/*,.svg" color="#db2777" />
            <QuickUpload label="🎬 Video" accept="video/*" color="#7c3aed" />
            <QuickUpload label="🎵 Audio" accept="audio/*" color="#059669" />
            <QuickUpload label="📑 PDF" accept=".pdf" color="#dc2626" />
            <QuickUpload label="📊 Excel/CSV" accept=".xlsx,.xls,.csv" color="#16a34a" />
            <QuickUpload label="📝 Word" accept=".docx" color="#2563eb" />
            <QuickUpload label="🧱 3D Model" accept=".stl,.obj,.glb" color="#ea580c" />
            <QuickUpload label="🗄️ Database" accept=".sql,.db,.sqlite" color="#0891b2" />
            <QuickUpload label="📦 ZIP" accept=".zip" color="#854d0e" />
            <QuickUpload label="💻 Code" accept=".js,.py,.html,.css,.json,.rs,.go" color="#4b5563" />
          </div>
        )}
      </header>

      <main style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0", flex: 1 }}>
        {type ? (
          <div style={{ width: "96%", display: "flex", flexDirection: "column", gap: "25px" }}>
            <div style={{ background: "#0f172a", borderRadius: "16px", border: "1px solid #334155", height: "70vh", width: "100%", display: "flex", flexDirection: "column", overflow: "hidden", position: 'relative' }}>
              <div style={{ background: "#1e293b", padding: "10px 25px", fontSize: "14px", display: 'flex', justifyContent: 'space-between', borderBottom: "1px solid #334155" }}>
                <span>FILE: {fileName}</span>
                <span style={{ color: "#38bdf8" }}>{type.toUpperCase()} MODE</span>
              </div>

              <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", background: "#000", position: 'relative', overflow: 'hidden' }}>
                {type === "image" && (
                  <div style={{ position: 'relative' }}>
                    <img id="studio-img" ref={imageDisplayRef} src={url} alt="preview" style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", filter: imageFilterStyle }} />
                    {isCropping && (
                      <div style={{
                        position: 'absolute', border: '2px dashed #38bdf8', boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                        left: `${cropData.x}${cropUnit}`, top: `${cropData.y}${cropUnit}`,
                        width: `${cropData.width}${cropUnit}`, height: `${cropData.height}${cropUnit}`
                      }} />
                    )}
                  </div>
                )}
                {type === "video" && <video ref={mediaRef} controls style={{ maxWidth: "100%", maxHeight: "100%" }} src={url} />}
                {type === "audio" && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                    <canvas ref={canvasRef} width="600" height="200" style={{ background: '#0f172a', borderRadius: '12px' }} />
                    <audio ref={mediaRef} controls src={url} onPlay={handleAudioPlay} />
                  </div>
                )}
                {type === "pdf" && <iframe src={url} width="100%" height="100%" title="pdf" />}
                {type === "text" && <pre style={{ width: "100%", height: "100%", padding: "25px", color: "#94a3b8", overflow: "auto", whiteSpace: "pre-wrap" }}>{content}</pre>}
                {type === "code" && <Editor height="100%" language={language} value={content} theme="vs-dark" onChange={setContent} options={{ fontSize: 18 }} />}
                {type === "archive" && (
                  <div style={{ width: '100%', padding: '40px', overflow: 'auto' }}>
                    <h3>Contents of {fileName}:</h3>
                    <ul style={{ color: '#38bdf8', listStyle: 'none' }}>
                      {zipFiles.map((f, i) => <li key={i} style={{ marginBottom: '5px' }}>{f.dir ? "📁" : "📄"} {f.name}</li>)}
                    </ul>
                  </div>
                )}
                {type === "3d" && <div style={{ textAlign: 'center' }}><h3>3D Model Detected</h3><p>{content}</p><div style={{ fontSize: '50px' }}>🧊</div></div>}
                {type === "unknown" && (
                  <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>
                    <p style={{ color: '#ef4444' }}>⚠️ Unknown binary file. Hex dump:</p>
                    <pre style={{ textAlign: 'left', background: '#1e293b', padding: '20px', borderRadius: '10px', fontSize: '12px', overflow: 'auto', maxHeight: '50vh' }}>{content}</pre>
                  </div>
                )}
              </div>
            </div>

            <div style={{ background: "#1e293b", padding: "25px", borderRadius: "16px", border: "1px solid #334155" }}>
              {type === "image" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "25px" }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px' }}>Brightness</label>
                    <input type="range" min="0" max="200" value={brightness} onChange={(e) => setBrightness(e.target.value)} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px' }}>Contrast</label>
                    <input type="range" min="0" max="200" value={contrast} onChange={(e) => setContrast(e.target.value)} style={{ width: '100%' }} />
                  </div>
                  <button onClick={downloadImage} style={{ background: "#10b981", color: "white", padding: "12px", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: 'pointer' }}>
                    Download
                  </button>
                </div>
              )}
              {type === "code" && (
                <button onClick={runCode} style={{ background: "#10b981", color: "white", padding: "12px 50px", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: 'pointer' }}>
                  ▶ RUN EXECUTION
                </button>
              )}
            </div>

            {type === "code" && (
              <div style={{ background: "#000", borderRadius: "16px", padding: "20px", border: "1px solid #334155" }}>
                <p style={{ color: "#64748b", fontSize: "12px", margin: "0 0 10px 0" }}>CONSOLE / PREVIEW</p>
                <pre style={{ color: "#10b981", margin: "0 0 15px 0" }}>{output || "> Ready..."}</pre>
                <iframe id="preview" title="Code Preview" style={{ width: "100%", height: "50vh", background: 'white', border: 'none', borderRadius: '8px' }} />
              </div>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", textAlign: 'center' }}>
            <div>
              <h2 style={{ fontSize: "2rem", marginBottom: '10px' }}>No File Selected</h2>
              <p>Upload any file to analyze and view its contents.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
