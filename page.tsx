// pages/index.tsx
"use client";

import React, { useRef, useState } from "react";
import { Upload } from "lucide-react";

type Status = "idle" | "ready" | "uploading" | "processing" | "done" | "error";

const ENDPOINT = "http://127.0.0.1:5000/process_video_and_ai_detection"; // 

export default function HomePage() {
  const [dragActive, setDragActive] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState<number>(0);
  const [average, setAverage] = useState<number | null>(null);
  const [results, setResults] = useState<any[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const resetState = () => {
    setVideoFile(null);
    setStatus("idle");
    setProgress(0);
    setAverage(null);
    setResults(null);
    setErrorMsg(null);
    xhrRef.current = null;
  };

  const onDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    handleSelectedFile(file);
  };

  const handleSelectedFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      alert("Please upload a video file.");
      return;
    }
    setVideoFile(file);
    setStatus("ready");
    setAverage(null);
    setResults(null);
    setErrorMsg(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    handleSelectedFile(file);
  };

  const openFilePicker = () => inputRef.current?.click();

  const handleCreate = () => {
    if (!videoFile) return alert("Pick a video first.");

    setStatus("uploading");
    setProgress(0);
    setErrorMsg(null);
    setAverage(null);
    setResults(null);

    const formData = new FormData();
    formData.append("video", videoFile);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.open("POST", ENDPOINT, true);

    // Upload progress
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        const pct = Math.round((ev.loaded / ev.total) * 100);
        setProgress(pct);
      }
    };

    // Optional: detect when upload completes (you may switch UI to 'processing' here)
    xhr.upload.onloadend = () => {
      // Upload is finished (server may still be processing)
      setStatus("processing");
    };

    xhr.onerror = () => {
      setStatus("error");
      setErrorMsg("Network error during upload.");
    };

    xhr.onabort = () => {
      setStatus("idle");
      setErrorMsg("Upload aborted by user.");
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== XMLHttpRequest.DONE) return;

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          setAverage(json.average ?? null);
          // your backend returns results in 'results' or All_Json_Values.json contents:
          setResults(json.results ?? json.all_results ?? null);
          setStatus("done");
        } catch (err) {
          setStatus("error");
          setErrorMsg("Invalid JSON response from server.");
        }
      } else {
        setStatus("error");
        // Try to parse server error message
        try {
          const parsed = JSON.parse(xhr.responseText);
          setErrorMsg(parsed.error || JSON.stringify(parsed));
        } catch {
          setErrorMsg(xhr.statusText || `Server error ${xhr.status}`);
        }
      }
    };

    try {
      xhr.send(formData);
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message ?? "Failed to send request.");
    }
  };

  const handleCancel = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
      setStatus("idle");
      setProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200">
      <main className="container mx-auto px-4 py-8">
        {/* Hero */}
        <section className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-800">
            Quick Start — Upload a Video
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            AI detector for videos. Upload a high-quality video and see approximate results in-page.
          </p>
        </section>

        {/* Upload area */}
        <section
          onDragEnter={onDrag}
          onDragLeave={onDrag}
          onDragOver={onDrag}
          onDrop={onDrop}
          className={`mb-8 p-8 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${dragActive ? "border-blue-400 bg-blue-50" : "border-gray-300"
            }`}
          onClick={openFilePicker}
        >
          <input
            ref={inputRef}
            id="fileUpload"
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="text-center select-none">
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              Drag & drop a video here, or click to select files
            </p>

            {videoFile ? (
              <div className="mt-3">
                <div className="font-medium text-gray-800">{videoFile.name}</div>
                <div className="text-sm text-gray-500">{(videoFile.size / 1024 / 1024).toFixed(2)} MB</div>
              </div>
            ) : (
              <div className="mt-4">
                <label
                  htmlFor="fileUpload"
                  className="inline-block text-white font-semibold text-lg bg-blue-500 py-2 px-4 rounded-full cursor-pointer"
                >
                  Select File
                </label>
              </div>
            )}
          </div>

          {/* Create Button */}
          <div className="text-center mt-8">
            <button
              onClick={handleCreate}
              disabled={!videoFile || status === "uploading" || status === "processing"}
              className="text-white font-semibold text-lg bg-green-500 py-2 px-6 rounded-full disabled:opacity-50"
            >
              {status === "uploading" ? "Uploading..." : status === "processing" ? "Processing..." : "Create"}
            </button>

            {status === "uploading" || status === "processing" ? (
              <button
                onClick={handleCancel}
                className="ml-4 text-sm text-gray-700 bg-gray-200 py-2 px-4 rounded-full"
              >
                Cancel
              </button>
            ) : (
              <button
                onClick={resetState}
                className="ml-4 text-sm text-gray-700 bg-gray-200 py-2 px-4 rounded-full"
              >
                Reset
              </button>
            )}
          </div>

          {/* Progress */}
          {(status === "uploading" || status === "processing") && (
            <div className="mt-6 max-w-xl mx-auto text-center">
              <div className="text-sm text-gray-600 mb-2">
                {status === "uploading" ? `Uploading — ${progress}%` : "Server processing... please wait"}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="h-3 bg-green-500 transition-all"
                  style={{ width: `${status === "uploading" ? progress : 100}%` }}
                />
              </div>
            </div>
          )}
        </section>

        {/* Results area */}
        <section className="mb-12">
          {status === "error" && errorMsg && (
            <div className="p-4 bg-red-100 text-red-800 rounded">{errorMsg}</div>
          )}

          {status === "done" && (
            <div className="space-y-4">
              <div className="p-4 bg-white rounded shadow">
                <div className="text-sm text-gray-500">Frames processed:</div>
                <div className="text-2xl font-bold">{results ? results.length : "—"}</div>
              </div>

              <div className="p-4 bg-white rounded shadow">
                <div className="text-sm text-gray-500">AI-generated score (1 is highest):</div>
                <div className="text-2xl font-bold">{average ?? "—"}</div>
              </div>
{/* 
              <div className="p-4 bg-white rounded shadow">
                <h3 className="font-semibold mb-2">Detailed results (per frame)</h3>
                 <div className="max-h-96 overflow-auto bg-gray-50 p-2 rounded">
                  <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(results ?? [], null, 2)}</pre>
                </div> 
              </div> */}
            </div>
          )}

          {status === "idle" && (
            <div className="text-gray-600">Select a video to begin processing.</div>
          )}

          {status === "ready" && (
            <div className="text-gray-600">Video ready. Click <strong>Create</strong> to upload & process.</div>
          )}
        </section>
      </main>

      <style jsx>{`
        @keyframes gradientAnimation {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .bg-gradient-to-b {
          background-size: 200% 200%;
          animation: gradientAnimation 10s ease infinite;
        }
        pre { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", "Courier New", monospace; }
      `}</style>
    </div>
  );
}