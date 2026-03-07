import React, { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import Editor from "@monaco-editor/react";
import JSZip from "jszip";
// ADDED: Cropper Imports
//import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
//import 'react-image-crop/dist/ReactCrop.css';

function App() {
  const [type, setType] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [output, setOutput] = useState("");
  const [fileName, setFileName] = useState("");
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [zipFiles, setZipFiles] = useState([]);

  // --- TOGGLE STATE ---
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
  
  // ADDED: IMAGE LIBRARY STATE
  const [imageLibrary, setImageLibrary] = useState([]);

  // PDF ZOOM STATE
  const [pdfZoom, setPdfZoom] = useState(100);

  // ADDED: New States for Cropper Tool
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);

  const mediaRef = useRef(null);
  const imageDisplayRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const audioCtxRef = useRef(null);

  // --- MUSIC APP STATES ---
  const [library, setLibrary] = useState([]); 
  const [playlists, setPlaylists] = useState({ "My Favorites": [] });
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPlaylist, setCurrentPlaylist] = useState("All Songs");

  // --- ADDED: FOLDER & LIKED STATES ---
  const [folders, setFolders] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState({});

  // --- ADDED: MOBILE RESPONSIVE STATE ---
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // --- ADDED: DRAG AND DROP STATE ---
  const [isDragging, setIsDragging] = useState(false);

  // --- NEW ADDITIONS: HISTORY & STATS ---
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [fileStats, setFileStats] = useState(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // --- ADDED: KEYBOARD SHORTCUTS ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space" && type === "audio") {
        e.preventDefault();
        if (mediaRef.current) {
          mediaRef.current.paused ? mediaRef.current.play() : mediaRef.current.pause();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [type]);

  // --- ADDED: DRAG AND DROP HANDLERS ---
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      if (files.length > 1 || files[0].type.startsWith("audio")) {
        handleBatchUpload({ target: { files } });
      } else {
        openFile(files[0]);
      }
    }
  };

  // --- ADDED: FOLDER LOGIC ---
  const createFolder = () => {
    const folderName = prompt("Enter folder name:");
    if (folderName && !folders.includes(folderName)) {
      setFolders(prev => [...prev, folderName]);
    }
  };

  const toggleFolder = (folder) => {
    setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  // --- ADDED: BATCH IMAGE UPLOAD HANDLER ---
  const handleBatchImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const newImages = files
      .filter(file => file.type.startsWith("image"))
      .map(file => ({
        name: file.name,
        url: URL.createObjectURL(file),
        id: Math.random().toString(36).substr(2, 9) + Date.now()
      }));

    if (newImages.length > 0) {
      setImageLibrary(prev => [...prev, ...newImages]);
      setType("image");
      if (!url) {
        setUrl(newImages[0].url);
        setFileName(newImages[0].name);
      }
    }
    setHistory(prev => [{ name: `Batch: ${newImages.length} images`, time: new Date().toLocaleTimeString(), type: 'image/batch' }, ...prev]);
  };

  // --- IMPROVED: BATCH UPLOAD FOR "ALL SONGS" DISPLAY ---
  const handleBatchUpload = async (e) => {
    const files = Array.from(e.target.files || e.dataTransfer.files);
    if (files.length === 0) return;

    setHistory(prev => [{ name: `Batch: ${files.length} files`, time: new Date().toLocaleTimeString(), type: 'audio/batch' }, ...prev]);

    const newSongs = files
      .filter(file => file.type.startsWith("audio"))
      .map(file => ({
        name: file.name,
        url: URL.createObjectURL(file),
        id: Math.random().toString(36).substr(2, 9) + Date.now()
      }));

    if (newSongs.length > 0) {
      setLibrary(prev => {
        const existingNames = new Set(prev.map(s => s.name));
        const uniqueNewSongs = newSongs.filter(s => !existingNames.has(s.name));
        const updatedLibrary = [...prev, ...uniqueNewSongs];
        return updatedLibrary.sort((a, b) => 
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
        );
      });
      
      setType("audio");
      if (!url && newSongs[0]) {
        setFileName(newSongs[0].name);
        setUrl(newSongs[0].url);
      }
    }
  };

  const playSong = (song) => {
    setUrl(song.url);
    setFileName(song.name);
    setTimeout(() => {
      if (mediaRef.current) {
        mediaRef.current.load();
        mediaRef.current.play().catch(e => console.log("Playback interrupted"));
      }
    }, 50);
  };

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

  const openFile = async (file) => {
    if (!file) return;

    setFileStats({
        size: (file.size / 1024).toFixed(2) + " KB",
        modified: new Date(file.lastModified).toLocaleDateString()
    });
    setHistory(prev => [{ name: file.name, time: new Date().toLocaleTimeString(), type: file.type || "unknown" }, ...prev]);

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
    setPdfZoom(100);

    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }

    if (fileType.startsWith("image") || extension === "svg") {
      setType("image");
      const blobUrl = URL.createObjectURL(file);
      setUrl(blobUrl);
      setImageLibrary(prev => prev.find(i => i.name === file.name) ? prev : [...prev, { name: file.name, url: blobUrl, id: Date.now() }]);
    } else if (fileType.startsWith("video")) {
      setType("video");
      setUrl(URL.createObjectURL(file));
    } else if (fileType.startsWith("audio")) {
      setType("audio");
      const blobUrl = URL.createObjectURL(file);
      setUrl(blobUrl);
      const newSong = { name: file.name, url: blobUrl, id: Date.now() };
      setLibrary(prev => {
         if (prev.find(s => s.name === newSong.name)) return prev;
         const updated = [...prev, newSong];
         return updated.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
      });
    } else if (fileType === "application/pdf" || extension === "pdf") {
      setType("pdf");
      setUrl(URL.createObjectURL(file));
    } else if (extension === "zip") {
      const zip = await JSZip.loadAsync(file);
      const files = Object.keys(zip.files).map(name => ({ name, dir: zip.files[name].dir }));
      setZipFiles(files);
      setType("archive");
    } else if (["xlsx", "xls", "csv"].includes(extension)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        setContent(XLSX.utils.sheet_to_json(sheet, { header: 1 }).map(row => row.join("\t")).join("\n"));
        setType("text");
      };
      reader.readAsArrayBuffer(file);
    } else if (["stl", "obj", "glb", "gltf"].includes(extension)) {
      setType("3d");
      setContent(`3D Model Rendering Engine Initializing for: ${extension}`);
    } else if (["sql", "sqlite", "db", "json"].includes(extension)) {
      const text = await file.text();
      setType("code");
      setContent(text);
      setLanguage(extension === "json" ? "json" : "sql");
    } else if (extension === "docx") {
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      setType("text");
      setContent(result.value);
    } else if (fileType.startsWith("text/") || ["js", "py", "java", "c", "cpp", "html", "css", "md", "xml", "php", "rb", "go", "rs", "swift"].includes(extension)) {
      const text = await file.text();
      setType("code");
      setContent(text);
      const langMap = { py: 'python', java: 'java', html: 'html', css: 'css', md: 'markdown', rs: 'rust' };
      setLanguage(langMap[extension] || "javascript");
    } else {
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
      const srcDoc = `<html><head><style>body{font-family:sans-serif;padding:15px;}${language === "css" ? content : ""}</style></head><body>${language === "html" ? content : ""}<script>try {${language === "javascript" ? content : ""}} catch(err) {document.body.innerHTML += "<pre style='color:red'>" + err + "</pre>";}</script></body></html>`;
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
    const img = imageDisplayRef.current;
    if (!img) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (completedCrop?.width && completedCrop?.height) {
      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;
      canvas.width = completedCrop.width * scaleX;
      canvas.height = completedCrop.height * scaleY;
      ctx.filter = imageFilterStyle;
      ctx.drawImage(
        img,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0, 0, canvas.width, canvas.height
      );
    } else {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.filter = imageFilterStyle;
      ctx.drawImage(img, 0, 0);
    }

    const link = document.createElement("a");
    link.download = `converted_${fileName.split('.')[0]}.${exportFormat.split('/')[1]}`;
    link.href = canvas.toDataURL(exportFormat);
    link.click();
  };

  const addToPlaylist = (song, pName) => {
    setPlaylists(prev => ({
      ...prev,
      [pName]: prev[pName].some(s => s.id === song.id) ? prev[pName] : [...prev[pName], song]
    }));
  };

  const createNewPlaylist = () => {
    const name = prompt("Enter playlist name:");
    if (name && !playlists[name]) {
      setPlaylists(prev => ({ ...prev, [name]: [] }));
    }
  };

  const downloadAudio = (songUrl, name) => {
    const link = document.createElement("a");
    link.href = songUrl;
    link.download = name;
    link.click();
  };

  const QuickUpload = ({ label, accept, color, isAudio, isImageBatch }) => (
    <label style={{ background: color, color: "white", padding: "8px 15px", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem", fontWeight: "bold", border: "1px solid rgba(255,255,255,0.1)" }}>
      {label}
      <input type="file" accept={accept} multiple={isAudio || isImageBatch} hidden onChange={(e) => {
        if (isAudio) handleBatchUpload(e);
        else if (isImageBatch) handleBatchImageUpload(e);
        else if (e.target.files[0]) openFile(e.target.files[0]);
        e.target.value = null;
      }} />
    </label>
  );

  return (
    <div 
      onDragOver={handleDragOver} 
      onDragLeave={handleDragLeave} 
      onDrop={handleDrop}
      style={{ background: "#020617", minHeight: "100vh", width: "100vw", color: "#f8fafc", fontFamily: "sans-serif", display: "flex", flexDirection: "column", overflowX: "hidden", position: "relative" }}
    >
      {isDragging && (
        <div style={{ position: "absolute", inset: 0, zIndex: 999, background: "rgba(37, 99, 235, 0.2)", border: "4px dashed #2563eb", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", backdropFilter: "blur(4px)" }}>
          <h2 style={{ color: "white", fontSize: "3rem", fontWeight: "bold" }}>Drop files to Open</h2>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          h1 { font-size: 1.5rem !important; }
          .main-content { flex-direction: column !important; overflow-y: auto !important; }
          aside { width: 100% !important; border-right: none !important; border-bottom: 1px solid #1e293b !important; height: auto !important; max-height: 50vh !important; }
          main { padding: 10px 0 !important; width: 100% !important; }
          .audio-inner-container { width: 98% !important; padding: 0 5px !important; }
          footer { height: auto !important; padding: 10px !important; flex-wrap: wrap !important; }
          footer div { flex: none !important; width: 100% !important; text-align: center !important; margin-bottom: 5px; }
          .folder-btn { padding: 12px !important; }
          .code-controls { flex-direction: column !important; gap: 10px !important; }
          .code-controls button { width: 100% !important; padding: 12px !important; }
          .pdf-controls { width: 100% !important; flex-wrap: wrap; justify-content: center !important; gap: 10px !important; }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      <header style={{ width: "100%", background: "#1e293b", padding: "20px 0", textAlign: "center", borderBottom: "1px solid #475569" }}>
        <h1 style={{ margin: "0 0 10px 0", fontSize: "2.5rem", fontWeight: "800" }}>UniView Studio Pro</h1>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ marginBottom: "15px", background: "#475569", color: "white", border: "none", padding: "5px 15px", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}>
            {isMenuOpen ? "Hide Tools ▲" : "Show Tools ▼"}
            </button>
            <button onClick={() => setShowHistory(!showHistory)} style={{ marginBottom: "15px", background: showHistory ? "#38bdf8" : "#475569", color: showHistory ? "#000" : "white", border: "none", padding: "5px 15px", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}>
            {showHistory ? "Close Activity Log" : "📜 Activity Log"}
            </button>
        </div>
        <div style={{ marginBottom: "15px" }}>
          <label style={{ background: "#2563eb", color: "white", padding: "12px 40px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "1.1rem", display: "inline-block" }}>
            📁 Open Any File
            <input type="file" hidden onChange={(e) => openFile(e.target.files[0])} />
          </label>
        </div>
        {isMenuOpen && (
          <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap", padding: "0 20px" }}>
            <QuickUpload label="🖼️ Batch Images" accept="image/*,.svg" color="#db2777" isImageBatch={true} />
            <QuickUpload label="🎬 Video" accept="video/*" color="#7c3aed" />
            <QuickUpload label="🎵 Batch Audio" accept="audio/*" color="#059669" isAudio={true} />
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

      <div className="main-content" style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {((type === "audio" || library.length > 0) || showHistory) && (
          <aside style={{ width: isMobile ? "100%" : "280px", background: "#000", borderRight: isMobile ? "none" : "1px solid #1e293b", padding: "20px", display: "flex", flexDirection: "column", gap: "20px", overflowY: "auto" }}>
            
            {showHistory ? (
                <div style={{ animation: "fadeIn 0.3s" }}>
                    <p style={{ color: "#38bdf8", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "15px" }}>Recent Activity</p>
                    {history.length === 0 ? <p style={{ color: "#475569", fontSize: "0.8rem" }}>No session history yet.</p> : (
                        <ul style={{ listStyle: "none", padding: 0 }}>
                            {history.map((h, i) => (
                                <li key={i} style={{ padding: "10px", borderBottom: "1px solid #1e293b", fontSize: "0.8rem" }}>
                                    <div style={{ color: "white", fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis" }}>{h.name}</div>
                                    <div style={{ color: "#64748b", fontSize: "0.7rem" }}>{h.time} • {h.type}</div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            ) : (
                <>
                    <input type="text" placeholder="🔍 Search library..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ background: "#1e293b", border: "none", padding: "10px", borderRadius: "20px", color: "white", width: "100%", boxSizing: "border-box" }} />
                    
                    <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={createNewPlaylist} style={{ flex: 1, background: "#1e293b", border: "1px solid #334155", color: "#38bdf8", padding: "8px", borderRadius: "6px", fontSize: "0.75rem", cursor: "pointer" }}>+ Playlist</button>
                    <button onClick={createFolder} style={{ flex: 1, background: "#1e293b", border: "1px solid #334155", color: "#fbbf24", padding: "8px", borderRadius: "6px", fontSize: "0.75rem", cursor: "pointer" }}>+ Folder</button>
                    </div>

                    <div>
                    <p style={{ color: "#94a3b8", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "15px" }}>Library</p>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                        <li onClick={() => { setCurrentPlaylist("All Songs"); setType("audio"); }} style={{ cursor: "pointer", padding: "12px", borderRadius: "8px", background: currentPlaylist === "All Songs" ? "#1e293b" : "transparent", color: currentPlaylist === "All Songs" ? "#38bdf8" : "white", fontWeight: "bold", marginBottom: "5px" }}>🏠 All Songs ({library.length})</li>
                        
                        <li onClick={() => { setCurrentPlaylist("My Favorites"); setType("audio"); }} style={{ cursor: "pointer", padding: "12px", borderRadius: "8px", background: currentPlaylist === "My Favorites" ? "#1e293b" : "transparent", color: "#f472b6", fontWeight: "bold", marginBottom: "5px" }}>❤️ Liked Songs</li>

                        {folders.map(folder => (
                        <div key={folder} style={{ marginBottom: "5px" }}>
                            <li className="folder-btn" onClick={() => toggleFolder(folder)} style={{ cursor: "pointer", padding: "10px", borderRadius: "8px", background: "#0f172a", color: "#fbbf24", display: "flex", justifyContent: "space-between" }}>
                            <span>📂 {folder}</span>
                            <span>{expandedFolders[folder] ? "▼" : "▶"}</span>
                            </li>
                            {expandedFolders[folder] && (
                            <div style={{ paddingLeft: "20px", marginTop: "5px", color: "#64748b", fontSize: "0.8rem" }}>
                                (Empty Folder)
                            </div>
                            )}
                        </div>
                        ))}

                        {currentPlaylist === "All Songs" && (
                        <div style={{ marginLeft: "10px", borderLeft: "1px solid #334155", paddingLeft: "10px", marginBottom: "20px" }}>
                            {library.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).map((song, i) => (
                            <li key={i} onClick={() => playSong(song)} style={{ fontSize: "0.85rem", padding: "8px 5px", cursor: "pointer", color: fileName === song.name ? "#38bdf8" : "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {fileName === song.name ? "🔊 " : "• "}{song.name}
                            </li>
                            ))}
                        </div>
                        )}

                        <p style={{ color: "#94a3b8", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1.5px", marginTop: "20px", marginBottom: "10px" }}>Playlists</p>
                        {Object.keys(playlists).map(p => {
                        if (p === "My Favorites") return null;
                        return (
                            <li key={p} onClick={() => { setCurrentPlaylist(p); setType("audio"); }} style={{ cursor: "pointer", padding: "10px", color: currentPlaylist === p ? "#38bdf8" : "white" }}>📻 {p}</li>
                        )
                        })}
                    </ul>
                    </div>
                </>
            )}
          </aside>
        )}

        <main style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0", flex: 1, overflowY: "auto", marginBottom: library.length > 0 ? "90px" : "0" }}>
          {type ? (
            <div style={{ width: "96%", display: "flex", flexDirection: "column", gap: "25px" }} className="audio-inner-container">
              <div style={{ background: "#0f172a", borderRadius: "16px", border: "1px solid #334155", minHeight: "70vh", width: "100%", display: "flex", flexDirection: "column", overflow: "hidden", position: 'relative' }}>
                <div style={{ background: "#1e293b", padding: "10px 25px", fontSize: "14px", display: 'flex', justifyContent: 'space-between', borderBottom: "1px solid #334155" }}>
                  <div style={{ display: 'flex', gap: '15px' }}>
                      <span>FILE: {fileName}</span>
                      {fileStats && <span style={{ color: '#64748b' }}>[{fileStats.size} • {fileStats.modified}]</span>}
                  </div>
                  <span style={{ color: "#38bdf8" }}>{type.toUpperCase()} MODE</span>
                </div>
                <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", background: "#000", position: 'relative', overflow: 'hidden', padding: isMobile ? "10px" : "20px" }}>
                  {type === "audio" && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: "100%", height: "100%" }}>
                      
                      <div style={{ background: "#1e293b", padding: "15px", borderRadius: "12px", width: isMobile ? "100%" : "90%", border: "1px dashed #38bdf8", textAlign: "center" }}>
                        <p style={{ margin: "0 0 10px 0", color: "#94a3b8", fontSize: "0.8rem" }}>Import Audio Collection:</p>
                        <label style={{ background: "#059669", color: "white", padding: "12px 20px", borderRadius: "6px", cursor: "pointer", fontSize: "0.9rem", fontWeight: "bold", display: "inline-block" }}>
                          🎵 Select All Songs
                          <input type="file" multiple accept="audio/*" hidden onChange={handleBatchUpload} />
                        </label>
                        {!isMobile && <p style={{ margin: "5px 0 0 0", color: "#475569", fontSize: "0.7rem" }}>Tip: You can also drag & drop files anywhere!</p>}
                      </div>

                      <div style={{ width: "100%", flex: 1, display: "flex", justifyContent: "center", alignItems: "center", minHeight: "200px" }}>
                        <canvas ref={canvasRef} width="1000" height="300" style={{ background: '#0f172a', borderRadius: '12px', width: "90%", height: "100%", objectFit: "contain" }} />
                      </div>
                      <div style={{ width: isMobile ? "100%" : "90%", background: "#1e293b", borderRadius: "12px", padding: isMobile ? "10px" : "20px", border: "1px solid #334155" }}>
                        <h3 style={{ margin: "0 0 15px 0", color: "#38bdf8" }}>{currentPlaylist} View</h3>
                        <div style={{ maxHeight: "250px", overflowY: "auto" }}>
                          {(currentPlaylist === "All Songs" ? library : playlists[currentPlaylist])
                            .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map((song, i) => (
                              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px", borderBottom: "1px solid #334155", alignItems: "center", background: fileName === song.name ? "#0f172a" : "transparent", borderRadius: "8px", margin: "4px 0" }}>
                                <div onClick={() => playSong(song)} style={{ cursor: "pointer", flex: 1, display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
                                  <span style={{ color: fileName === song.name ? "#38bdf8" : "white" }}>{fileName === song.name ? "🔊" : "▶"}</span>
                                  <span style={{ fontSize: isMobile ? "0.8rem" : "1rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{song.name}</span>
                                </div>
                                <div style={{ display: "flex", gap: isMobile ? "10px" : "15px" }}>
                                  <button 
                                    onClick={() => addToPlaylist(song, "My Favorites")} 
                                    style={{ 
                                      background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem",
                                      filter: playlists["My Favorites"].some(s => s.id === song.id) ? "none" : "grayscale(1)"
                                    }}
                                  >
                                    ❤️
                                  </button>
                                  <button onClick={() => downloadAudio(song.url, song.name)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem" }}>⬇️</button>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                      <audio ref={mediaRef} controls src={url} onPlay={handleAudioPlay} style={{ width: "90%", height: "40px" }} />
                    </div>
                  )}

                  {type === "image" && (
                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center' }}>
                        {/* NEW: Batch Upload UI for Images */}
                        <div style={{ background: "#1e293b", padding: "15px", borderRadius: "12px", width: isMobile ? "100%" : "90%", border: "1px dashed #db2777", textAlign: "center", marginBottom: "20px" }}>
                          <p style={{ margin: "0 0 10px 0", color: "#94a3b8", fontSize: "0.8rem" }}>Batch Import Images:</p>
                          <label style={{ background: "#db2777", color: "white", padding: "12px 20px", borderRadius: "6px", cursor: "pointer", fontSize: "0.9rem", fontWeight: "bold", display: "inline-block" }}>
                            📸 Select All Images
                            <input type="file" multiple accept="image/*" hidden onChange={handleBatchImageUpload} />
                          </label>
                        </div>

                        {/* NEW: Image Selection Gallery */}
                        {imageLibrary.length > 1 && (
                          <div style={{ display: "flex", gap: "10px", overflowX: "auto", padding: "10px", background: "#0f172a", borderRadius: "12px", width: "90%", marginBottom: "20px", border: "1px solid #334155" }}>
                            {imageLibrary.map((img) => (
                              <img 
                                key={img.id} 
                                src={img.url} 
                                onClick={() => { setUrl(img.url); setFileName(img.name); }}
                                alt="thumb"
                                style={{ height: "60px", borderRadius: "6px", cursor: "pointer", border: url === img.url ? "2px solid #db2777" : "2px solid transparent", transition: "0.2s" }} 
                              />
                            ))}
                          </div>
                        )}

                        <div style={{ background: '#1e293b', padding: '12px', borderRadius: '10px', marginBottom: '15px', display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center', border: '1px solid #334155' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Format:</label>
                                <select 
                                    value={exportFormat} 
                                    onChange={(e) => setExportFormat(e.target.value)}
                                    style={{ background: '#0f172a', color: 'white', border: '1px solid #475569', padding: '4px', borderRadius: '4px' }}
                                >
                                    <option value="image/png">PNG</option>
                                    <option value="image/jpeg">JPG</option>
                                    <option value="image/webp">WEBP</option>
                                </select>
                            </div>

                            <button 
                                onClick={() => setIsCropping(!isCropping)}
                                style={{ background: isCropping ? '#38bdf8' : '#475569', color: isCropping ? '#000' : '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                            >
                                {isCropping ? "✅ Confirm Crop Area" : "✂️ Toggle Crop"}
                            </button>

                            <button 
                                onClick={downloadImage}
                                style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                            >
                                💾 Convert & Save
                            </button>
                        </div>

                        <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
                            {isCropping ? (
                                <ReactCrop
                                    crop={crop}
                                    onChange={(c) => setCrop(c)}
                                    onComplete={(c) => setCompletedCrop(c)}
                                >
                                    <img 
                                        ref={imageDisplayRef}
                                        src={url} 
                                        alt="editor"
                                        style={{ maxHeight: "70vh", objectFit: "contain", filter: imageFilterStyle }}
                                    />
                                </ReactCrop>
                            ) : (
                                <img 
                                    id="studio-img" 
                                    ref={imageDisplayRef} 
                                    src={url} 
                                    alt="preview" 
                                    style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", filter: imageFilterStyle }} 
                                />
                            )}
                        </div>

                        <div style={{ marginTop: '15px', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                            <label style={{ fontSize: '0.75rem' }}>Brightness: <input type="range" min="0" max="200" value={brightness} onChange={(e) => setBrightness(e.target.value)} /></label>
                            <label style={{ fontSize: '0.75rem' }}>Contrast: <input type="range" min="0" max="200" value={contrast} onChange={(e) => setContrast(e.target.value)} /></label>
                        </div>
                    </div>
                  )}

                  {type === "video" && <video ref={mediaRef} controls style={{ maxWidth: "100%", maxHeight: "100%" }} src={url} />}
                  
                  {type === "pdf" && (
                    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
                        <div className="pdf-controls" style={{ background: "#1e293b", padding: "10px", display: "flex", justifyContent: "center", gap: "20px", alignItems: "center", borderBottom: "1px solid #334155" }}>
                            <button onClick={() => setPdfZoom(Math.max(50, pdfZoom - 10))} style={{ background: "#475569", color: "white", border: "none", padding: "8px 15px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>➖ Zoom Out</button>
                            <span style={{ fontSize: "0.9rem", color: "#38bdf8", fontWeight: "bold", minWidth: "60px", textAlign: "center" }}>{pdfZoom}%</span>
                            <button onClick={() => setPdfZoom(Math.min(300, pdfZoom + 10))} style={{ background: "#475569", color: "white", border: "none", padding: "8px 15px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>➕ Zoom In</button>
                            <button onClick={() => setPdfZoom(100)} style={{ background: "#2563eb", color: "white", border: "none", padding: "8px 15px", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem" }}>Reset</button>
                        </div>
                        <div style={{ flex: 1, overflow: "auto", background: "#334155", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: isMobile ? "0" : "20px" }}>
                            <div style={{ width: `${pdfZoom}%`, height: "100%", transition: "width 0.2s ease-in-out" }}>
                                <iframe 
                                    src={`${url}#view=FitH`} 
                                    width="100%" 
                                    height="100%" 
                                    title="pdf-viewer" 
                                    style={{ border: "none", borderRadius: isMobile ? "0" : "8px", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }} 
                                />
                            </div>
                        </div>
                    </div>
                  )}

                  {type === "text" && <pre style={{ width: "100%", height: "100%", padding: "25px", color: "#94a3b8", overflow: "auto", whiteSpace: "pre-wrap" }}>{content}</pre>}
                  
                  {type === "code" && (
                    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", gap: "15px" }}>
                      
                      <div style={{ height: isMobile ? "300px" : "400px", width: "100%", border: "1px solid #334155", borderRadius: "8px", overflow: "hidden", background: "#1e1e1e" }}>
                        <div style={{ background: "#2d2d2d", padding: "5px 15px", color: "#94a3b8", fontSize: "0.8rem", borderBottom: "1px solid #334155" }}>EDITOR: {fileName}</div>
                        <Editor height="calc(100% - 30px)" language={language} value={content} theme="vs-dark" onChange={setContent} options={{ fontSize: isMobile ? 14 : 18 }} />
                      </div>

                      <div className="code-controls" style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
                        <button onClick={runCode} style={{ background: "#10b981", color: "white", border: "none", padding: "12px 60px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "1rem", boxShadow: "0 4px 14px 0 rgba(16, 185, 129, 0.39)" }}>
                          ▶ Run Code
                        </button>
                        <button onClick={() => setOutput("")} style={{ background: "#475569", color: "white", border: "none", padding: "12px 30px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>
                          Clear Console
                        </button>
                      </div>

                      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: "15px", flex: 1, minHeight: isMobile ? "auto" : "350px" }}>
                        
                        <div style={{ flex: 1, height: isMobile ? "150px" : "auto", background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", padding: "15px", overflowY: "auto", fontFamily: "'Fira Code', monospace", color: "#10b981" }}>
                          <div style={{ fontWeight: "bold", marginBottom: "10px", color: "#64748b", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "1px" }}>Output Console</div>
                          <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: "0.9rem", lineHeight: "1.4" }}>{output || "$ waiting for execution..."}</pre>
                        </div>

                        <div style={{ flex: 1.2, height: isMobile ? "250px" : "auto", background: "white", border: "1px solid #334155", borderRadius: "8px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                          <div style={{ background: "#e2e8f0", padding: "5px 12px", color: "#475569", fontSize: "0.7rem", fontWeight: "bold", borderBottom: "1px solid #cbd5e1" }}>LIVE BROWSER PREVIEW</div>
                          <iframe id="preview" title="browser-preview" style={{ flex: 1, width: "100%", border: "none" }} />
                        </div>

                      </div>
                    </div>
                  )}

                  {type === "archive" && <div style={{ width: '100%', padding: '40px', overflow: 'auto' }}><h3>Contents:</h3><ul style={{ color: '#38bdf8', listStyle: 'none' }}>{zipFiles.map((f, i) => <li key={i}>{f.dir ? "📁" : "📄"} {f.name}</li>)}</ul></div>}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", textAlign: 'center' }}>
              <div><h2 style={{ fontSize: "2rem", marginBottom: '10px' }}>No File Selected</h2><p>Upload files to analyze content.</p><p style={{ fontSize: "0.9rem", color: "#334155" }}>Drag & drop any file here!</p></div>
            </div>
          )}
        </main>
      </div>

      {library.length > 0 && (
        <footer style={{ height: "90px", background: "#0f172a", borderTop: "2px solid #334155", display: "flex", alignItems: "center", padding: "0 30px", position: "fixed", bottom: 0, width: "100%", zIndex: 100, boxSizing: "border-box" }}>
          <div style={{ flex: 1 }}><p style={{ margin: 0, fontWeight: "bold", fontSize: "1rem", color: "#38bdf8" }}>{fileName}</p><p style={{ margin: 0, color: "#94a3b8", fontSize: "0.8rem" }}>Now Playing</p></div>
          <div style={{ flex: 2, display: "flex", justifyContent: "center" }}><p style={{ color: "#10b981", margin: 0, fontWeight: "500" }}>Live Audio Analysis Active</p></div>
          <div style={{ flex: 1, textAlign: "right", color: "#64748b", fontSize: "0.8rem" }}>UniView Music Suite v1.1</div>
        </footer>
      )}
    </div>
  );
}

export default App;
