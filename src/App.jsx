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

  // --- TOGGLE STATE (DEFAULT HIDE TOOLS) ---
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

    if (fileType.startsWith("image") || extension === "svg") {
      setType("image");
      setUrl(URL.createObjectURL(file));
    }
    else if (fileType.startsWith("video")) {
      setType("video");
      setUrl(URL.createObjectURL(file));
    }
    else if (fileType.startsWith("audio")) {
      setType("audio");
      setUrl(URL.createObjectURL(file));
    }
    else if (fileType === "application/pdf" || extension === "pdf") {
      setType("pdf");
      setUrl(URL.createObjectURL(file));
    }
    else if (extension === "zip") {
      const zip = await JSZip.loadAsync(file);
      const files = Object.keys(zip.files).map(name => ({ name, dir: zip.files[name].dir }));
      setZipFiles(files);
      setType("archive");
    }
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
    else if (["stl", "obj", "glb", "gltf"].includes(extension)) {
      setType("3d");
      setContent(`3D Model Rendering Engine Initializing for: ${extension}`);
    }
    else if (["sql", "sqlite", "db", "json"].includes(extension)) {
      const text = await file.text();
      setType("code");
      setContent(text);
      setLanguage(extension === "json" ? "json" : "sql");
    }
    else if (extension === "docx") {
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      setType("text");
      setContent(result.value);
    }
    else if (fileType.startsWith("text/") || ["js", "py", "java", "c", "cpp", "html", "css", "md", "xml", "php", "rb", "go", "rs", "swift"].includes(extension)) {
      const text = await file.text();
      setType("code");
      setContent(text);
      const langMap = { py: 'python', java: 'java', html: 'html', css: 'css', md: 'markdown', rs: 'rust' };
      setLanguage(langMap[extension] || "javascript");
    }
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
      background: color, color: "white", padding: "6px 10px", borderRadius: "4px", 
      cursor: "pointer", fontSize: "0.75rem", fontWeight: "600", border: "none",
      width: "100%", textAlign: "left", boxSizing: "border-box", display: "block", 
      marginBottom: "4px", opacity: 0.9, transition: "opacity 0.2s"
    }}
    onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
    onMouseLeave={(e) => e.currentTarget.style.opacity = "0.9"}
    >
      {label}
      <input type="file" accept={accept} hidden onChange={(e) => {
        if (e.target.files[0]) openFile(e.target.files[0]);
        e.target.value = null;
      }} />
    </label>
  );

  return (
    <div style={{ 
      background: "radial-gradient(circle at top right, #0f172a, #020617)", 
      height: "100vh", width: "100vw", color: "#f8fafc", fontFamily: "sans-serif", display: "flex", overflow: "hidden" 
    }}>
      
      {/* GLOW ANIMATIONS */}
      <style>{`
        @keyframes neon-glow {
          0% { border-color: #1e293b; box-shadow: 0 0 5px rgba(56,189,248,0.2); }
          50% { border-color: #38bdf8; box-shadow: 0 0 20px rgba(56,189,248,0.5); }
          100% { border-color: #1e293b; box-shadow: 0 0 5px rgba(56,189,248,0.2); }
        }
        .glow-effect { animation: neon-glow 4s infinite ease-in-out; }
      `}</style>

      {/* --- SIDEBAR FIXED --- */}
      <aside style={{ 
        width: isMenuOpen ? "160px" : "50px", 
        flexShrink: 0,
        background: "rgba(15, 23, 42, 0.9)", 
        borderRight: "2px solid #38bdf8", 
        display: "flex", 
        flexDirection: "column", 
        transition: "width 0.2s ease-in-out",
        padding: "10px 6px",
        overflowX: "hidden",
        boxShadow: "5px 0 15px rgba(0,0,0,0.5)"
      }}>
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          style={{ 
            background: "#1e293b", color: "#38bdf8", border: "1px solid #38bdf8", 
            padding: "8px", borderRadius: "4px", cursor: "pointer", 
            marginBottom: "15px", fontSize: "0.9rem", display: "flex", justifyContent: "center",
            boxShadow: "0 0 10px rgba(56,189,248,0.3)"
          }}
        >
          {isMenuOpen ? "✕" : "☰"}
        </button>

        {isMenuOpen && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <p style={{ fontSize: "0.6rem", color: "#38bdf8", fontWeight: "bold", textTransform: "uppercase", marginBottom: "8px", paddingLeft: "4px" }}>Modules</p>
            <QuickUpload label="🖼️ Image" accept="image/*,.svg" color="#be185d" />
            <QuickUpload label="🎬 Video" accept="video/*" color="#6d28d9" />
            <QuickUpload label="🎵 Audio" accept="audio/*" color="#047857" />
            <QuickUpload label="📑 PDF" accept=".pdf" color="#b91c1c" />
            <QuickUpload label="📊 Excel" accept=".xlsx,.xls,.csv" color="#15803d" />
            <QuickUpload label="📝 Word" accept=".docx" color="#1d4ed8" />
            <QuickUpload label="🧱 3D" accept=".stl,.obj,.glb" color="#c2410c" />
            <QuickUpload label="🗄️ Database" accept=".sql,.db,.sqlite" color="#0e7490" />
            <QuickUpload label="📦 ZIP" accept=".zip" color="#713f12" />
            <QuickUpload label="💻 Code" accept=".js,.py,.html,.css,.json,.rs,.go" color="#374151" />
            <div style={{ margin: "10px 0", borderTop: "1px solid #1e293b" }} />
            <label style={{ background: "#2563eb", color: "white", padding: "6px 10px", borderRadius: "4px", cursor: "pointer", fontWeight: "600", textAlign: "center", fontSize: "0.75rem" }}>
              📁 All Files
              <input type="file" hidden onChange={(e) => {
                if (e.target.files[0]) openFile(e.target.files[0]);
                e.target.value = null;
              }} />
            </label>
          </div>
        )}
      </aside>

      {/* --- MAIN CONTENT AREA FIXED --- */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {/* GLOWING HEADER */}
        <header style={{ 
          background: "linear-gradient(to right, #1e293b, #0f172a)", 
          padding: "10px 20px", 
          borderBottom: "2px solid #38bdf8", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between",
          boxShadow: "0 0 20px rgba(56, 189, 248, 0.4)"
        }}>
          <h1 style={{ 
            margin: 0, 
            fontSize: "1.4rem", 
            fontWeight: "900", 
            fontFamily: "Orbitron, sans-serif",
            letterSpacing: "3px",
            textTransform: "uppercase",
            background: "linear-gradient(90deg, #38bdf8, #818cf8, #38bdf8)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 8px rgba(56, 189, 248, 0.8))"
          }}>
            Universal View X Pro
          </h1>
          {fileName && <span style={{ fontSize: "0.75rem", color: "#38bdf8", border: "1px solid #38bdf8", padding: "2px 8px", borderRadius: "10px" }}>{fileName}</span>}
        </header>

        <main style={{ 
          display: "flex", flexDirection: "column", alignItems: "center", padding: "15px", flex: 1, overflow: "hidden",
          background: "url('https://www.transparenttextures.com/patterns/dark-matter.png')" 
        }}>
          {type ? (
            <div className="glow-effect" style={{ 
              width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: "10px", overflow: "hidden",
              border: "2px solid #1e293b", borderRadius: "12px", background: "rgba(15, 23, 42, 0.7)", padding: "10px"
            }}>
              <div style={{ background: "#000", borderRadius: "8px", flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: 'relative' }}>
                <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", position: 'relative', overflow: 'hidden' }}>
                  {type === "image" && (
                    <img id="studio-img" ref={imageDisplayRef} src={url} alt="preview" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", filter: imageFilterStyle }} />
                  )}
                  {type === "video" && <video ref={mediaRef} controls style={{ maxWidth: "100%", maxHeight: "100%" }} src={url} />}
                  {type === "audio" && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                      <canvas ref={canvasRef} width="500" height="150" style={{ background: '#0f172a', borderRadius: '8px', border: "1px solid #38bdf8" }} />
                      <audio ref={mediaRef} controls src={url} onPlay={handleAudioPlay} />
                    </div>
                  )}
                  {type === "pdf" && <iframe src={url} width="100%" height="100%" title="pdf" style={{ border: "none" }} />}
                  {type === "text" && <pre style={{ width: "100%", height: "100%", padding: "20px", color: "#38bdf8", overflow: "auto", whiteSpace: "pre-wrap", fontSize: "0.85rem", margin: 0 }}>{content}</pre>}
                  {type === "code" && (
                    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
                      <Editor height="100%" width="50%" language={language} value={content} theme="vs-dark" onChange={setContent} options={{ fontSize: 14 }} />
                      <div style={{ width: "50%", background: "#fff", display: "flex", flexDirection: "column" }}>
                        <div style={{ background: "#0f172a", color: "#38bdf8", padding: "4px", fontSize: "10px", textAlign: "center", fontWeight: "bold" }}>LIVE BROWSER PREVIEW</div>
                        <iframe id="preview" style={{ flex: 1, border: "none" }} />
                      </div>
                    </div>
                  )}
                  {type === "archive" && (
                    <div style={{ width: '100%', padding: '20px', overflow: 'auto' }}>
                      <ul style={{ color: '#38bdf8', listStyle: 'none', padding: 0, fontSize: "0.9rem" }}>
                        {zipFiles.map((f, i) => <li key={i} style={{ marginBottom: '4px' }}>{f.dir ? "📁" : "📄"} {f.name}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ background: "rgba(30, 41, 59, 0.9)", padding: "10px 15px", borderRadius: "8px", border: "1px solid #38bdf8" }}>
                {type === "image" && (
                  <div style={{ display: "flex", gap: "20px", alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: '11px', color: "#38bdf8" }}>Brightness</label>
                      <input type="range" min="0" max="200" value={brightness} onChange={(e) => setBrightness(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: '11px', color: "#38bdf8" }}>Contrast</label>
                      <input type="range" min="0" max="200" value={contrast} onChange={(e) => setContrast(e.target.value)} />
                    </div>
                    <button onClick={downloadImage} style={{ background: "#10b981", color: "white", padding: "6px 15px", border: "none", borderRadius: "4px", fontSize: "0.8rem", fontWeight: "bold", cursor: 'pointer' }}>Save Image</button>
                  </div>
                )}
                {type === "code" && (
                  <button onClick={runCode} style={{ background: "linear-gradient(to right, #10b981, #059669)", color: "white", padding: "8px 30px", border: "none", borderRadius: "4px", fontSize: "0.85rem", fontWeight: "bold", cursor: 'pointer', boxShadow: "0 0 10px rgba(16, 185, 129, 0.5)" }}>
                    ▶ EXECUTE & RENDER
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textAlign: 'center' }}>
              <div style={{ padding: "40px", border: "2px dashed #38bdf8", borderRadius: "20px", background: "rgba(56, 189, 248, 0.05)" }}>
                <h2 style={{ fontSize: "1.5rem", color: "#38bdf8", textShadow: "0 0 10px rgba(56, 189, 248, 0.5)" }}>UNIVERSAL VIEW X PRO</h2>
                <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>System ready. Please select a module from the terminal sidebar.</p>
              </div>
            </div>
          )}
        </main>

        {/* TERMINAL OUTPUT */}
        {output && (
          <div style={{ height: "120px", background: "#020617", borderTop: "2px solid #38bdf8", padding: "10px", display: "flex", flexDirection: "column" }}>
              <div style={{ color: "#38bdf8", fontSize: "0.7rem", fontWeight: "bold", marginBottom: "5px" }}>CONSOLE_LOG_STREAM:</div>
              <div style={{ flex: 1, overflowY: "auto", fontFamily: "monospace", fontSize: "0.8rem", color: "#10b981" }}>
                  {"> "}{output}
              </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
