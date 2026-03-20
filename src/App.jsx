import React, { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import Editor from "@monaco-editor/react";
import JSZip from "jszip";
// ADDED: Word Preview Import for high-fidelity rendering     
import { renderAsync } from "docx-preview";
// ADDED: PPTX Preview Import for high-fidelity rendering

//import { renderPptx } from "pptx-renderer/dist/index.js";
// ADDED: Cropper Imports
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

function App() {
  const [type, setType] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [output, setOutput] = useState("");
  const [fileName, setFileName] = useState("");
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [zipFiles, setZipFiles] = useState([]);
  // ADDED: ZIP Object state for extraction
  const [activeZip, setActiveZip] = useState(null);
  // ADDED: Virtual File System for extracted content
  const [extractedFolder, setExtractedFolder] = useState(null);

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
  // ADDED: Reference for the Word Document rendering container
  const wordRef = useRef(null);
  // ADDED: Reference for the PowerPoint rendering container
  const pptRef = useRef(null);

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

  // ADDED: State for Excel/CSV Data Table
  const [sheetData, setSheetData] = useState([]);

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
    setActiveZip(null);
    setExtractedFolder(null);
    setBrightness(100);
    setContrast(100);
    setGrayscale(0);
    setHue(0);
    setIsCropping(false);
    setPlaybackSpeed(1);
    setPdfZoom(100);
    setSheetData([]);

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
      setActiveZip(zip);
      const files = Object.keys(zip.files).map(name => {
        const f = zip.files[name];
        return {
          name,
          dir: f.dir,
          size: f._data ? (f._data.uncompressedSize / 1024).toFixed(2) + " KB" : "0 KB",
          date: f.date ? new Date(f.date).toLocaleString() : "Unknown"
        };
      });
      setZipFiles(files);
      setType("archive");
    } else if (["xlsx", "xls", "csv"].includes(extension)) {
      // MODIFIED: High-Fidelity Excel/CSV Rendering Logic
      setType("excel");
      const reader = new FileReader();
      reader.onload = (e) => {
        const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        setSheetData(data);
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
      // ADDED: Word File High-Fidelity Logic
      setType("word");
      const arrayBuffer = await file.arrayBuffer();
      // Wait for React to render the div before calling docx-preview
      setTimeout(() => {
        if (wordRef.current) {
          wordRef.current.innerHTML = "";
          renderAsync(arrayBuffer, wordRef.current, wordRef.current, {
            className: "docx",
            inWrapper: false,
            ignoreLastRenderedPageBreak: false
          });
        }
      }, 150);
    }
    // ADDED: PPTX File High-Fidelity Logic
    else if (extension === "pptx") {
      setType("pptx");
      const arrayBuffer = await file.arrayBuffer();
      setTimeout(async () => {
        if (pptRef.current) {
          pptRef.current.innerHTML = "";
          try {
            await renderPptx(arrayBuffer, pptRef.current, {
              padding: 20,
              showSlideNumber: true,
              theme: 'light'
            });
          } catch (err) {
            console.error("PPTX Rendering Error:", err);
            pptRef.current.innerHTML = "<p style='color:white; padding:20px;'>Error rendering PowerPoint content.</p>";
          }
        }
      }, 150);
    }
    else if (fileType.startsWith("text/") || ["js", "py", "java", "c", "cpp", "html", "css", "md", "xml", "php", "rb", "go", "rs", "swift"].includes(extension)) {
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

  const downloadUnzippedFile = async (name) => {
    if (!activeZip) return;
    const fileData = await activeZip.file(name).async("blob");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(fileData);
    link.download = name.split('/').pop();
    link.click();
  };

  const unzipAllAndBrowse = async () => {
    if (!activeZip) return;
    const virtualFS = {};
    const promises = Object.keys(activeZip.files).map(async (name) => {
      const zipEntry = activeZip.files[name];
      if (!zipEntry.dir) {
        const blob = await zipEntry.async("blob");
        const ext = name.split('.').pop().toLowerCase();
        const mime = getMimeFromExtension(ext);
        virtualFS[name] = new File([blob], name, { type: mime });
      }
    });
    await Promise.all(promises);
    setExtractedFolder(virtualFS);
  };

  const getMimeFromExtension = (ext) => {
    const map = {
      'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'svg': 'image/svg+xml',
      'pdf': 'application/pdf', 'js': 'text/javascript', 'py': 'text/x-python', 'json': 'application/json',
      'html': 'text/html', 'css': 'text/css', 'mp3': 'audio/mpeg', 'wav': 'audio/wav'
    };
    return map[ext] || 'text/plain';
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
    <label style={{
      background: `linear-gradient(135deg, ${color}, ${color}dd)`,
      color: "white",
      padding: "10px 18px",
      borderRadius: "12px",
      cursor: "pointer",
      fontSize: "0.85rem",
      fontWeight: "600",
      border: "1px solid rgba(255,255,255,0.15)",
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
      transition: "transform 0.2s, box-shadow 0.2s",
      display: "flex",
      alignItems: "center",
      gap: "8px"
    }} className="hover-lift">
      {label}
      <input type="file" accept={accept} multiple={isAudio || isImageBatch} hidden onChange={(e) => {
        if (isAudio) handleBatchUpload(e);
        else if (isImageBatch) handleBatchImageUpload(e);
        else if (e.target.files[0]) openFile(e.target.files[0]);
        e.target.value = null;
      }} />
    </label>
  );

  // --- NEW ADDED FEATURE: WORD PREVIEW RENDERER ---
  // Renders document in Word Container for high fidelity
  const renderWordHighFidelity = async (buffer) => {
    if (wordRef.current) {
      wordRef.current.innerHTML = "";
      await renderAsync(buffer, wordRef.current, wordRef.current, {
        className: "docx",
        inWrapper: false
      });
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ background: "#020617", minHeight: "100vh", width: "100vw", color: "#f8fafc", fontFamily: "'Inter', system-ui, -apple-system, sans-serif", display: "flex", flexDirection: "column", overflowX: "hidden", position: "relative" }}
    >
      {isDragging && (
        <div style={{ position: "absolute", inset: 0, zIndex: 999, background: "rgba(37, 99, 235, 0.15)", border: "4px dashed #3b82f6", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", backdropFilter: "blur(8px)" }}>
          <div style={{ background: "rgba(15, 23, 42, 0.8)", padding: "40px 60px", borderRadius: "30px", border: "1px solid rgba(255,255,255,0.1)", textAlign: "center" }}>
            <h2 style={{ color: "white", fontSize: "3rem", fontWeight: "bold", margin: 0 }}>Release to Open</h2>
            <p style={{ color: "#94a3b8", marginTop: "10px" }}>Your files will be processed instantly</p>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap');
        
        .hover-lift:hover { transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3); }
        .glass-sidebar { background: rgba(0, 0, 0, 0.4) !important; backdrop-filter: blur(10px); border-right: 1px solid rgba(255,255,255,0.05) !important; }
        .studio-main-card { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }

        @media (max-width: 768px) {
          h1 { font-size: 1.5rem !important; }
          .main-content { flex-direction: column !important; overflow-y: auto !important; height: auto !important; flex: none !important; }
          aside { width: 100% !important; border-right: none !important; border-bottom: 1px solid #1e293b !important; height: auto !important; max-height: 50vh !important; }
          main { padding: 10px 0 !important; width: 100% !important; overflow-y: visible !important; }
          .audio-inner-container { width: 98% !important; padding: 0 5px !important; }
          footer { height: auto !important; padding: 15px !important; flex-wrap: wrap !important; }
          footer div { flex: none !important; width: 100% !important; text-align: center !important; margin-bottom: 5px; }
          .folder-btn { padding: 12px !important; }
        }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade { animation: fadeIn 0.4s ease-out forwards; }
        
        .docx-wrapper { padding: 40px !important; background: #1e293b !important; }
        .docx { background: white !important; color: black !important; padding: 50px !important; box-shadow: 0 20px 40px rgba(0,0,0,0.4); border-radius: 8px; margin: 0 auto; max-width: 850px; }
        
        .excel-table { border-collapse: separate; border-spacing: 0; width: max-content; min-width: 100%; background: white; color: #1e293b; border-radius: 8px; overflow: hidden; }
        .excel-table th, .excel-table td { border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; padding: 12px 18px; font-size: 0.85rem; text-align: left; }
        .excel-table th { background: #f8fafc; font-weight: 700; color: #475569; position: sticky; top: 0; z-index: 10; text-transform: uppercase; letter-spacing: 0.5px; }
        .excel-table tr:hover { background: #f1f5f9; }
      `}</style>

      <header style={{ width: "100%", background: "rgba(15, 23, 42, 0.8)", backdropFilter: "blur(12px)", padding: "25px 0", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", zIndex: 50 }}>
        <h1 style={{ margin: "0 0 15px 0", fontSize: "2.8rem", fontWeight: "900", background: "linear-gradient(to right, #38bdf8, #818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-1px" }}>UniView Studio Pro</h1>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: "20px" }}>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ background: isMenuOpen ? "#334155" : "rgba(255,255,255,0.05)", color: "white", border: "1px solid rgba(255,255,255,0.1)", padding: "8px 18px", borderRadius: "20px", cursor: "pointer", fontSize: "0.85rem", fontWeight: "600", transition: "0.3s" }}>
            {isMenuOpen ? "Close Tools" : "Quick Tools"}
          </button>
          <button onClick={() => setShowHistory(!showHistory)} style={{ background: showHistory ? "rgba(56, 189, 248, 0.15)" : "rgba(255,255,255,0.05)", color: showHistory ? "#38bdf8" : "white", border: showHistory ? "1px solid #38bdf8" : "1px solid rgba(255,255,255,0.1)", padding: "8px 18px", borderRadius: "20px", cursor: "pointer", fontSize: "0.85rem", fontWeight: "600", transition: "0.3s" }}>
            {showHistory ? "Activity Log" : "📜 History"}
          </button>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)", color: "white", padding: "14px 45px", borderRadius: "14px", cursor: "pointer", fontWeight: "700", fontSize: "1.1rem", display: "inline-block", boxShadow: "0 10px 25px -5px rgba(37, 99, 235, 0.4)", transition: "0.3s" }} className="hover-lift">
            📁 Open Any File
            <input type="file" hidden onChange={(e) => openFile(e.target.files[0])} />
          </label>
        </div>

        {isMenuOpen && (
          <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap", padding: "0 20px", animation: "fadeIn 0.3s ease-out" }}>
            <QuickUpload label="🖼️ Images" accept="image/*,.svg" color="#db2777" isImageBatch={true} />
            <QuickUpload label="🎬 Video" accept="video/*" color="#7c3aed" />
            <QuickUpload label="🎵 Audio" accept="audio/*" color="#059669" isAudio={true} />
            <QuickUpload label="📑 PDF" accept=".pdf" color="#dc2626" />
            <QuickUpload label="📊 Excel" accept=".xlsx,.xls,.csv" color="#16a34a" />
            <QuickUpload label="📝 Word" accept=".docx" color="#2563eb" />
            <QuickUpload label="📽️ PPTX" accept=".pptx" color="#d24726" />
            <QuickUpload label="🧱 3D" accept=".stl,.obj,.glb" color="#ea580c" />
            <QuickUpload label="🗄️ DB" accept=".sql,.db,.sqlite" color="#0891b2" />
            <QuickUpload label="📦 ZIP" accept=".zip" color="#854d0e" />
            <QuickUpload label="💻 Code" accept=".js,.py,.html,.css,.json" color="#4b5563" />
          </div>
        )}
      </header>

      <div className="main-content" style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {((type === "audio" || library.length > 0) || showHistory) && (
          <aside className="glass-sidebar custom-scrollbar" style={{ width: isMobile ? "100%" : "300px", padding: "25px", display: "flex", flexDirection: "column", gap: "25px", overflowY: "auto", transition: "0.3s" }}>

            {showHistory ? (
              <div className="animate-fade">
                <p style={{ color: "#38bdf8", fontSize: "0.7rem", fontWeight: "800", textTransform: "uppercase", letterSpacing: "2px", marginBottom: "20px" }}>Session History</p>
                {history.length === 0 ? (
                  <div style={{ padding: "30px 10px", textAlign: "center", color: "#475569" }}>No activity recorded</div>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0 }}>
                    {history.map((h, i) => (
                      <li key={i} style={{ padding: "14px", borderRadius: "12px", background: "rgba(255,255,255,0.03)", marginBottom: "10px", border: "1px solid rgba(255,255,255,0.05)", transition: "0.2s" }} className="hover-lift">
                        <div style={{ color: "white", fontWeight: "600", fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis" }}>{h.name}</div>
                        <div style={{ color: "#64748b", fontSize: "0.7rem", marginTop: "4px" }}>{h.time} • {h.type.split('/')[1] || h.type}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="animate-fade">
                <input type="text" placeholder="🔍 Search library..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", padding: "12px 20px", borderRadius: "12px", color: "white", width: "100%", boxSizing: "border-box", fontSize: "0.9rem", outline: "none" }} />

                <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
                  <button onClick={createNewPlaylist} style={{ flex: 1, background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.2)", color: "#38bdf8", padding: "10px", borderRadius: "10px", fontSize: "0.75rem", fontWeight: "700", cursor: "pointer" }}>+ Playlist</button>
                  <button onClick={createFolder} style={{ flex: 1, background: "rgba(251, 191, 36, 0.1)", border: "1px solid rgba(251, 191, 36, 0.2)", color: "#fbbf24", padding: "10px", borderRadius: "10px", fontSize: "0.75rem", fontWeight: "700", cursor: "pointer" }}>+ Folder</button>
                </div>

                <div style={{ marginTop: "30px" }}>
                  <p style={{ color: "#475569", fontSize: "0.7rem", fontWeight: "800", textTransform: "uppercase", letterSpacing: "2px", marginBottom: "15px" }}>Collections</p>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    <li onClick={() => { setCurrentPlaylist("All Songs"); setType("audio"); }} style={{ cursor: "pointer", padding: "14px", borderRadius: "12px", background: currentPlaylist === "All Songs" ? "rgba(56, 189, 248, 0.15)" : "transparent", color: currentPlaylist === "All Songs" ? "#38bdf8" : "#94a3b8", fontWeight: "700", marginBottom: "8px", transition: "0.2s" }} className="hover-lift">🏠 All Songs <span style={{ float: "right", opacity: 0.5 }}>{library.length}</span></li>

                    <li onClick={() => { setCurrentPlaylist("My Favorites"); setType("audio"); }} style={{ cursor: "pointer", padding: "14px", borderRadius: "12px", background: currentPlaylist === "My Favorites" ? "rgba(244, 114, 182, 0.1)" : "transparent", color: currentPlaylist === "My Favorites" ? "#f472b6" : "#94a3b8", fontWeight: "700", marginBottom: "8px", transition: "0.2s" }} className="hover-lift">❤️ Liked Songs</li>

                    {folders.map(folder => (
                      <div key={folder} style={{ marginBottom: "8px" }}>
                        <li className="folder-btn" onClick={() => toggleFolder(folder)} style={{ cursor: "pointer", padding: "12px 14px", borderRadius: "12px", background: "rgba(251, 191, 36, 0.05)", color: "#fbbf24", display: "flex", justifyContent: "space-between", fontWeight: "700" }}>
                          <span>📂 {folder}</span>
                          <span>{expandedFolders[folder] ? "▼" : "▶"}</span>
                        </li>
                        {expandedFolders[folder] && (
                          <div style={{ paddingLeft: "20px", marginTop: "8px", color: "#475569", fontSize: "0.8rem", fontStyle: "italic" }}>
                            (Folder is empty)
                          </div>
                        )}
                      </div>
                    ))}

                    <div className="custom-scrollbar" style={{ maxHeight: "400px", overflowY: "auto", marginTop: "15px", borderLeft: "1px solid rgba(255,255,255,0.05)", marginLeft: "10px", paddingLeft: "15px" }}>
                      {currentPlaylist === "All Songs" && library.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).map((song, i) => (
                        <li key={i} onClick={() => playSong(song)} style={{ fontSize: "0.8rem", padding: "10px 0", cursor: "pointer", color: fileName === song.name ? "#38bdf8" : "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", transition: "0.2s", fontWeight: fileName === song.name ? "700" : "500" }}>
                          {fileName === song.name ? "● " : "○ "}{song.name}
                        </li>
                      ))}
                    </div>

                    <p style={{ color: "#475569", fontSize: "0.7rem", fontWeight: "800", textTransform: "uppercase", letterSpacing: "2px", marginTop: "30px", marginBottom: "15px" }}>Personal Playlists</p>
                    {Object.keys(playlists).map(p => {
                      if (p === "My Favorites") return null;
                      return (
                        <li key={p} onClick={() => { setCurrentPlaylist(p); setType("audio"); }} style={{ cursor: "pointer", padding: "12px 14px", borderRadius: "12px", color: currentPlaylist === p ? "#38bdf8" : "#94a3b8", background: currentPlaylist === p ? "rgba(56, 189, 248, 0.1)" : "transparent", fontWeight: "700", marginBottom: "5px" }}>📻 {p}</li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            )}
          </aside>
        )}

        <main className="custom-scrollbar" style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", padding: "30px 0", flex: 1, overflowY: "auto", marginBottom: library.length > 0 ? (isMobile ? "200px" : "120px") : "0" }}>
          {type ? (
            <div style={{ width: "94%", display: "flex", flexDirection: "column", gap: "30px" }} className="audio-inner-container animate-fade">
              <div className="studio-main-card" style={{ background: "#0f172a", borderRadius: "24px", border: "1px solid rgba(255,255,255,0.05)", minHeight: "75vh", width: "100%", display: "flex", flexDirection: "column", overflow: "hidden", position: 'relative' }}>
                <div style={{ background: "rgba(30, 41, 59, 0.7)", backdropFilter: "blur(10px)", padding: "15px 30px", fontSize: "0.85rem", display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <div style={{ background: "#38bdf8", color: "#000", fontWeight: "800", padding: "4px 10px", borderRadius: "6px", fontSize: "0.7rem" }}>{type.toUpperCase()}</div>
                    <span style={{ fontWeight: "600", color: "#f8fafc" }}>{fileName}</span>
                    {fileStats && <span style={{ color: '#475569', fontSize: "0.75rem" }}>{fileStats.size} • {fileStats.modified}</span>}
                  </div>
                </div>

                <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", background: "#020617", position: 'relative', overflow: 'hidden', padding: isMobile ? "10px" : "30px" }}>
                  {type === "audio" && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '30px', width: "100%", height: "100%" }}>

                      <div style={{ background: "rgba(56, 189, 248, 0.05)", padding: "25px", borderRadius: "20px", width: isMobile ? "100%" : "85%", border: "1px dashed rgba(56, 189, 248, 0.3)", textAlign: "center" }}>
                        <p style={{ margin: "0 0 15px 0", color: "#94a3b8", fontSize: "0.85rem", fontWeight: "500" }}>Expand your audio library:</p>
                        <label style={{ background: "#059669", color: "white", padding: "14px 25px", borderRadius: "12px", cursor: "pointer", fontSize: "0.9rem", fontWeight: "700", display: "inline-block", boxShadow: "0 10px 20px -5px rgba(5, 150, 105, 0.4)" }} className="hover-lift">
                          🎵 Import Tracks
                          <input type="file" multiple accept="audio/*" hidden onChange={handleBatchUpload} />
                        </label>
                      </div>

                      <div style={{ width: "100%", flex: 1, display: "flex", justifyContent: "center", alignItems: "center", minHeight: "250px" }}>
                        <canvas ref={canvasRef} width="1000" height="300" style={{ background: 'transparent', borderRadius: '12px', width: "95%", height: "100%", objectFit: "contain" }} />
                      </div>

                      <div style={{ width: isMobile ? "100%" : "85%", background: "rgba(30, 41, 59, 0.5)", borderRadius: "20px", padding: isMobile ? "15px" : "25px", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <h3 style={{ margin: "0 0 20px 0", color: "#38bdf8", fontSize: "1.1rem", fontWeight: "800" }}>{currentPlaylist}</h3>
                        <div className="custom-scrollbar" style={{ maxHeight: "280px", overflowY: "auto" }}>
                          {(currentPlaylist === "All Songs" ? library : playlists[currentPlaylist])
                            .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map((song, i) => (
                              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "15px", borderBottom: "1px solid rgba(255,255,255,0.03)", alignItems: "center", background: fileName === song.name ? "rgba(56, 189, 248, 0.08)" : "transparent", borderRadius: "12px", margin: "6px 0", transition: "0.2s" }} className="hover-lift">
                                <div onClick={() => playSong(song)} style={{ cursor: "pointer", flex: 1, display: "flex", alignItems: "center", gap: "15px", overflow: "hidden" }}>
                                  <div style={{ width: "35px", height: "35px", borderRadius: "50%", background: fileName === song.name ? "#38bdf8" : "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", transition: "0.3s" }}>
                                    <span style={{ color: fileName === song.name ? "#000" : "#94a3b8", fontSize: "0.8rem" }}>{fileName === song.name ? "❚❚" : "▶"}</span>
                                  </div>
                                  <span style={{ fontSize: isMobile ? "0.85rem" : "0.95rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: fileName === song.name ? "700" : "500" }}>{song.name}</span>
                                </div>
                                <div style={{ display: "flex", gap: "12px" }}>
                                  <button onClick={() => addToPlaylist(song, "My Favorites")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", filter: playlists["My Favorites"].some(s => s.id === song.id) ? "none" : "grayscale(1) opacity(0.3)", transition: "0.2s" }}>❤️</button>
                                  <button onClick={() => downloadAudio(song.url, song.name)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", opacity: 0.5 }}>⬇️</button>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                      <audio ref={mediaRef} controls src={url} onPlay={handleAudioPlay} style={{ width: "85%", height: "45px", borderRadius: "30px" }} />
                    </div>
                  )}

                  {type === "image" && (
                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center' }}>
                      <div style={{ background: "rgba(219, 39, 119, 0.05)", padding: "20px", borderRadius: "20px", width: isMobile ? "100%" : "90%", border: "1px dashed rgba(219, 39, 119, 0.3)", textAlign: "center", marginBottom: "25px" }}>
                        <label style={{ background: "#db2777", color: "white", padding: "12px 25px", borderRadius: "12px", cursor: "pointer", fontSize: "0.9rem", fontWeight: "700", display: "inline-block" }} className="hover-lift">
                          📸 Select All Images
                          <input type="file" multiple accept="image/*" hidden onChange={handleBatchImageUpload} />
                        </label>
                      </div>

                      {imageLibrary.length > 1 && (
                        <div className="custom-scrollbar" style={{ display: "flex", gap: "12px", overflowX: "auto", padding: "15px", background: "rgba(0,0,0,0.3)", borderRadius: "16px", width: "90%", marginBottom: "25px", border: "1px solid rgba(255,255,255,0.05)" }}>
                          {imageLibrary.map((img) => (
                            <img
                              key={img.id}
                              src={img.url}
                              onClick={() => { setUrl(img.url); setFileName(img.name); }}
                              alt="thumb"
                              style={{ height: "70px", width: "70px", objectFit: "cover", borderRadius: "10px", cursor: "pointer", border: url === img.url ? "3px solid #db2777" : "3px solid transparent", transition: "0.3s", transform: url === img.url ? "scale(1.05)" : "scale(1)" }}
                            />
                          ))}
                        </div>
                      )}

                      <div style={{ background: 'rgba(30, 41, 59, 0.8)', backdropFilter: "blur(10px)", padding: '15px 25px', borderRadius: '16px', marginBottom: '20px', display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: "700" }}>FORMAT:</label>
                          <select
                            value={exportFormat}
                            onChange={(e) => setExportFormat(e.target.value)}
                            style={{ background: '#0f172a', color: 'white', border: '1px solid #475569', padding: '6px 12px', borderRadius: '8px', fontSize: "0.85rem" }}
                          >
                            <option value="image/png">PNG</option>
                            <option value="image/jpeg">JPG</option>
                            <option value="image/webp">WEBP</option>
                          </select>
                        </div>

                        <button
                          onClick={() => setIsCropping(!isCropping)}
                          style={{ background: isCropping ? '#38bdf8' : 'rgba(255,255,255,0.1)', color: isCropping ? '#000' : '#fff', border: 'none', padding: '8px 18px', borderRadius: '10px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: "700", transition: "0.2s" }}
                        >
                          {isCropping ? "✅ Confirm Crop" : "✂️ Toggle Crop"}
                        </button>

                        <button
                          onClick={downloadImage}
                          style={{ background: '#10b981', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', boxShadow: "0 10px 15px -3px rgba(16, 185, 129, 0.3)" }}
                          className="hover-lift"
                        >
                          💾 Save Edited
                        </button>
                      </div>

                      <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', background: "#000", borderRadius: "12px", padding: "10px" }}>
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
                              style={{ maxHeight: "65vh", objectFit: "contain", filter: imageFilterStyle }}
                            />
                          </ReactCrop>
                        ) : (
                          <img
                            id="studio-img"
                            ref={imageDisplayRef}
                            src={url}
                            alt="preview"
                            style={{ maxWidth: "100%", maxHeight: "65vh", objectFit: "contain", filter: imageFilterStyle, borderRadius: "4px" }}
                          />
                        )}
                      </div>

                      <div style={{ marginTop: '25px', display: 'flex', gap: '30px', flexWrap: 'wrap', background: "rgba(255,255,255,0.03)", padding: "15px 30px", borderRadius: "15px" }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: "700", color: "#94a3b8" }}>BRIGHTNESS <input type="range" min="0" max="200" value={brightness} onChange={(e) => setBrightness(e.target.value)} style={{ display: "block", marginTop: "8px", width: "150px" }} /></label>
                        <label style={{ fontSize: '0.75rem', fontWeight: "700", color: "#94a3b8" }}>CONTRAST <input type="range" min="0" max="200" value={contrast} onChange={(e) => setContrast(e.target.value)} style={{ display: "block", marginTop: "8px", width: "150px" }} /></label>
                      </div>
                    </div>
                  )}

                  {type === "video" && <video ref={mediaRef} controls style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: "12px", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }} src={url} />}

                  {type === "pdf" && (
                    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
                      <div className="pdf-controls" style={{ background: "rgba(30, 41, 59, 0.8)", padding: "12px", display: "flex", justifyContent: "center", gap: "25px", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <button onClick={() => setPdfZoom(Math.max(50, pdfZoom - 10))} style={{ background: "rgba(255,255,255,0.1)", color: "white", border: "none", padding: "10px 20px", borderRadius: "10px", cursor: "pointer", fontWeight: "700" }}>➖</button>
                        <span style={{ fontSize: "1rem", color: "#38bdf8", fontWeight: "800", minWidth: "70px", textAlign: "center" }}>{pdfZoom}%</span>
                        <button onClick={() => setPdfZoom(Math.min(300, pdfZoom + 10))} style={{ background: "rgba(255,255,255,0.1)", color: "white", border: "none", padding: "10px 20px", borderRadius: "10px", cursor: "pointer", fontWeight: "700" }}>➕</button>
                        <button onClick={() => setPdfZoom(100)} style={{ background: "#2563eb", color: "white", border: "none", padding: "10px 20px", borderRadius: "10px", cursor: "pointer", fontSize: "0.8rem", fontWeight: "700" }}>RESET</button>
                      </div>
                      <div className="custom-scrollbar" style={{ flex: 1, overflow: "auto", background: "#1e293b", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: isMobile ? "0" : "30px" }}>
                        <div style={{ width: `${pdfZoom}%`, height: "100%", transition: "0.3s cubic-bezier(0.4, 0, 0.2, 1)" }}>
                          <iframe
                            src={`${url}#view=FitH`}
                            width="100%"
                            height="100%"
                            title="pdf-viewer"
                            style={{ border: "none", borderRadius: isMobile ? "0" : "12px", boxShadow: "0 30px 60px rgba(0,0,0,0.5)" }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {type === "text" && <pre className="custom-scrollbar" style={{ width: "100%", height: "100%", padding: "40px", color: "#cbd5e1", overflow: "auto", whiteSpace: "pre-wrap", fontSize: "1rem", lineHeight: "1.6", background: "#020617" }}>{content}</pre>}

                  {/* ADDED: Word File Display Container */}
                  {type === "word" && (
                    <div className="custom-scrollbar" style={{ width: "100%", height: "100%", overflow: "auto", padding: "30px", background: "#1e293b" }}>
                      <div ref={wordRef} style={{ width: "100%", minHeight: "100%" }}></div>
                    </div>
                  )}

                  {/* ADDED: PowerPoint File Display Container */}
                  {type === "pptx" && (
                    <div className="custom-scrollbar" style={{ width: "100%", height: "100%", overflow: "auto", padding: "30px", background: "#1e293b" }}>
                      <div ref={pptRef} style={{ width: "100%", minHeight: "100%", background: 'white', borderRadius: "8px" }}></div>
                    </div>
                  )}

                  {/* MODIFIED: Excel/CSV Table Display */}
                  {type === "excel" && (
                    <div className="custom-scrollbar" style={{ width: "100%", height: "100%", overflow: "auto", background: "#f1f5f9", padding: "20px" }}>
                      <table className="excel-table">
                        <thead>
                          <tr>
                            {sheetData[0]?.map((col, idx) => (
                              <th key={idx}>{col || `Col ${idx + 1}`}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sheetData.slice(1).map((row, rIdx) => (
                            <tr key={rIdx}>
                              {row.map((cell, cIdx) => (
                                <td key={cIdx}>{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {type === "code" && (
                    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", gap: "25px" }}>
                      <div style={{ height: isMobile ? "350px" : "450px", width: "100%", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", overflow: "hidden", background: "#1e1e1e", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}>
                        <div style={{ background: "#252526", padding: "10px 20px", color: "#858585", fontSize: "0.75rem", fontWeight: "700", borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between" }}>
                          <span>SOURCE: {fileName}</span>
                          <span style={{ color: "#38bdf8" }}>{language.toUpperCase()}</span>
                        </div>
                        <Editor height="calc(100% - 38px)" language={language} value={content} theme="vs-dark" onChange={setContent} options={{ fontSize: isMobile ? 14 : 16, fontFamily: "'Fira Code', monospace", padding: { top: 20 } }} />
                      </div>

                      <div className="code-controls" style={{ display: "flex", justifyContent: "center", gap: "15px" }}>
                        <button onClick={runCode} style={{ background: "linear-gradient(135deg, #10b981, #059669)", color: "white", border: "none", padding: "14px 60px", borderRadius: "12px", cursor: "pointer", fontWeight: "800", fontSize: "1rem", boxShadow: "0 10px 20px -5px rgba(16, 185, 129, 0.4)" }} className="hover-lift">
                          ▶ RUN CODE
                        </button>
                        <button onClick={() => setOutput("")} style={{ background: "rgba(255,255,255,0.05)", color: "white", border: "1px solid rgba(255,255,255,0.1)", padding: "14px 30px", borderRadius: "12px", cursor: "pointer", fontWeight: "600" }}>
                          Clear
                        </button>
                      </div>

                      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: "20px", flex: 1, minHeight: isMobile ? "auto" : "400px" }}>
                        <div className="custom-scrollbar" style={{ flex: 1, height: isMobile ? "200px" : "auto", background: "#020617", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "16px", padding: "20px", overflowY: "auto", fontFamily: "'Fira Code', monospace" }}>
                          <div style={{ fontWeight: "800", marginBottom: "15px", color: "#475569", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "2px" }}>Console Output</div>
                          <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: "0.95rem", lineHeight: "1.6", color: "#10b981" }}>{output || "$ system ready..."}</pre>
                        </div>

                        <div style={{ flex: 1.2, height: isMobile ? "300px" : "auto", background: "white", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }}>
                          <div style={{ background: "#f8fafc", padding: "10px 15px", color: "#475569", fontSize: "0.7rem", fontWeight: "800", borderBottom: "1px solid #e2e8f0", textTransform: "uppercase" }}>Live Preview</div>
                          <iframe id="preview" title="browser-preview" style={{ flex: 1, width: "100%", border: "none" }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {type === "archive" && (
                    <div className="custom-scrollbar" style={{ width: '100%', height: '100%', padding: '30px', overflow: 'auto', background: "#020617" }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '20px' }}>
                        <h3 style={{ color: '#38bdf8', margin: 0, fontSize: "1.4rem", fontWeight: "800" }}>📦 {fileName}</h3>
                        {!extractedFolder && (
                          <button
                            onClick={unzipAllAndBrowse}
                            style={{ background: '#f59e0b', color: '#000', border: 'none', padding: '12px 25px', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 10px 20px -5px rgba(245, 158, 11, 0.4)' }}
                            className="hover-lift"
                          >
                            ⚡ EXTRACT ALL
                          </button>
                        )}
                      </div>

                      <table className="zip-table" style={{ width: '100%', borderCollapse: 'collapse', color: '#f8fafc', fontSize: '0.9rem' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', borderBottom: '2px solid rgba(255,255,255,0.05)', color: '#475569' }}>
                            <th style={{ padding: '15px', textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "1px" }}>File Name</th>
                            <th style={{ padding: '15px', textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "1px" }}>Type</th>
                            <th style={{ padding: '15px', textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "1px" }}>Size</th>
                            <th style={{ padding: '15px', textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "1px", textAlign: "right" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {zipFiles.map((f, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)', transition: "0.2s" }} className="hover-lift">
                              <td style={{ padding: '15px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: "1.2rem" }}>{f.dir ? "📁" : "📄"}</span>
                                <span style={{ color: f.dir ? "#fbbf24" : "#38bdf8", fontWeight: "600" }}>{f.name}</span>
                              </td>
                              <td style={{ padding: '15px', color: '#475569', fontWeight: "600" }}>{f.dir ? "DIRECTORY" : "FILE"}</td>
                              <td style={{ padding: '15px', color: "#94a3b8" }}>{f.dir ? "--" : f.size}</td>
                              <td style={{ padding: '15px', textAlign: "right" }}>
                                {!f.dir && (
                                  <div style={{ display: 'flex', gap: '10px', justifyContent: "flex-end" }}>
                                    {extractedFolder && extractedFolder[f.name] ? (
                                      <button
                                        onClick={() => openFile(extractedFolder[f.name])}
                                        style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981", border: "1px solid #10b981", padding: "6px 15px", borderRadius: "8px", fontSize: "0.75rem", cursor: "pointer", fontWeight: "700" }}
                                      >
                                        OPEN
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => downloadUnzippedFile(f.name)}
                                        style={{ background: "rgba(37, 99, 235, 0.1)", color: "#3b82f6", border: "1px solid #3b82f6", padding: "6px 15px", borderRadius: "8px", fontSize: "0.75rem", cursor: "pointer", fontWeight: "700" }}
                                      >
                                        DOWNLOAD
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ height: isMobile ? "120px" : "40px" }}></div>
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", textAlign: 'center' }} className="animate-fade">
              <div style={{ background: "rgba(255,255,255,0.02)", padding: "60px", borderRadius: "40px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: "5rem", marginBottom: "20px", opacity: 0.2 }}>📂</div>
                <h2 style={{ fontSize: "2.2rem", marginBottom: '10px', color: "#f8fafc", fontWeight: "800" }}>No File Selected</h2>
                <p style={{ fontSize: "1.1rem", color: "#64748b", marginBottom: "30px" }}>Upload or drag & drop files to start your session.</p>
                <div style={{ display: "flex", gap: "15px", justifyContent: "center" }}>
                  <div style={{ padding: "10px 20px", borderRadius: "12px", background: "rgba(255,255,255,0.05)", fontSize: "0.8rem", color: "#94a3b8" }}>Images</div>
                  <div style={{ padding: "10px 20px", borderRadius: "12px", background: "rgba(255,255,255,0.05)", fontSize: "0.8rem", color: "#94a3b8" }}>Documents</div>
                  <div style={{ padding: "10px 20px", borderRadius: "12px", background: "rgba(255,255,255,0.05)", fontSize: "0.8rem", color: "#94a3b8" }}>Code</div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {library.length > 0 && (
        <footer style={{ height: "100px", background: "rgba(15, 23, 42, 0.9)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", padding: "0 40px", position: "fixed", bottom: 0, width: "100%", zIndex: 100, boxSizing: "border-box", boxShadow: "0 -20px 40px rgba(0,0,0,0.4)" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "20px" }}>
            <div style={{ width: "50px", height: "50px", background: "linear-gradient(135deg, #38bdf8, #818cf8)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", boxShadow: "0 10px 20px rgba(56, 189, 248, 0.3)" }}>🎵</div>
            <div>
              <p style={{ margin: 0, fontWeight: "800", fontSize: "1rem", color: "#f8fafc", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName}</p>
              <p style={{ margin: "2px 0 0 0", color: "#38bdf8", fontSize: "0.75rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px" }}>Now Streaming</p>
            </div>
          </div>
          <div style={{ flex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <span style={{ fontSize: "1.2rem", opacity: 0.5, cursor: "pointer" }}>⏮</span>
              <div style={{ width: "45px", height: "45px", borderRadius: "50%", background: "#f8fafc", color: "#000", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "0.9rem" }}>❚❚</div>
              <span style={{ fontSize: "1.2rem", opacity: 0.5, cursor: "pointer" }}>⏭</span>
            </div>
            <div style={{ width: "80%", height: "4px", background: "rgba(255,255,255,0.1)", borderRadius: "2px", position: "relative" }}>
              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: "35%", background: "#38bdf8", borderRadius: "2px", boxShadow: "0 0 10px #38bdf8" }}></div>
            </div>
          </div>
          <div style={{ flex: 1, textAlign: "right" }}>
            <p style={{ margin: 0, color: "#475569", fontSize: "0.75rem", fontWeight: "700", letterSpacing: "1px" }}>UNIVIEW ENGINE v1.2</p>
            <p style={{ margin: "2px 0 0 0", color: "#10b981", fontSize: "0.7rem", fontWeight: "600" }}>● HIGH FIDELITY ACTIVE</p>
          </div>
        </footer>
      )}
    </div>
  );
}

export default App;
