"use client";

import { useState, useRef, useEffect } from "react";

const loadingSentences = [
  "Rewiring your brain...",
  "Creating the magic words...",
  "Unlocking your full potential...",
  "Calming your inner world...",
  "Composing your transformation...",
  "Strengthening new pathways...",
  "Preparing your inner shift...",
  "Tuning your subconscious...",
  "Creating your personal ritual..."
];

export default function Home() {
  const [playingId, setPlayingId] = useState(null);
  const [audioState, setAudioState] = useState("idle");
  const [customInput, setCustomInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  
  const audioRef = useRef(null);

  const presets = [
    { id: "sleep", label: "Sleep" },
    { id: "smoking", label: "Smoking" },
    { id: "confidence", label: "Confidence" },
    { id: "relaxation", label: "Relaxation" }
  ];

  useEffect(() => {
    let interval;
    if (isGenerating) {
      interval = setInterval(() => {
        setLoadingTextIndex((prev) => (prev + 1) % loadingSentences.length);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  const stopCurrentAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const handlePlayPreset = async (presetId) => {
    setErrorMessage("");
    if (playingId === presetId && audioState === "playing") {
      stopCurrentAudio();
      setAudioState("idle");
      setPlayingId(null);
      return;
    }

    stopCurrentAudio();
    setIsGenerating(false);
    setPlayingId(presetId);
    setAudioState("loading_preset");

    try {
      const newAudio = new Audio(`/audio/${presetId}.wav`);
      audioRef.current = newAudio;
      
      newAudio.onended = () => {
        setAudioState("idle");
        setPlayingId(null);
      };

      newAudio.onerror = () => {
        setAudioState("idle");
        setPlayingId(null);
        setErrorMessage(`Audio not found. Place /audio/${presetId}.wav in public folder.`);
      };
      
      newAudio.play().then(() => {
        if (audioRef.current === newAudio) {
          setAudioState("playing");
        } else {
          newAudio.pause();
        }
      }).catch(e => {
        console.error("Playback failed", e);
        setAudioState("idle");
        setPlayingId(null);
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleCustomSubmit = async () => {
    if (!customInput.trim()) return;
    
    stopCurrentAudio();
    setPlayingId("custom");
    setAudioState("idle");
    setIsGenerating(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: customInput })
      });

      if (!res.ok) {
        throw new Error("Failed to generate audio. Please try again.");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      
      const generatedAudio = new Audio(url);
      audioRef.current = generatedAudio;
      
      generatedAudio.onended = () => {
        setAudioState("idle");
        setPlayingId(null);
        URL.revokeObjectURL(url);
      };

      generatedAudio.play().then(() => {
        setIsGenerating(false);
        setAudioState("playing");
      }).catch(e => {
        console.error("Custom Playback failed", e);
        setIsGenerating(false);
        setAudioState("idle");
        setPlayingId(null);
      });
    } catch (err) {
      console.error(err);
      setIsGenerating(false);
      setPlayingId(null);
      setErrorMessage("The calm energy was interrupted. Please softly retry your request.");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCustomSubmit();
    }
  };

  return (
    <>
      <div className="ambient-bg">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>
      
      <main className="container animate-in">
        <h1 className="delay-1">Glynosis</h1>
        
        <div className="presets-grid delay-2">
          {presets.map(preset => {
            const isActive = playingId === preset.id;
            const isLoading = isActive && audioState === "loading_preset";
            return (
              <button 
                key={preset.id}
                className={`preset-btn ${isActive ? 'active btn-is-playing' : ''}`}
                onClick={() => handlePlayPreset(preset.id)}
                disabled={isGenerating}
              >
                {isLoading ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-loader animate-spin"><line x1="12" x2="12" y1="2" y2="6"/><line x1="12" x2="12" y1="18" y2="22"/><line x1="4.93" x2="7.76" y1="4.93" y2="7.76"/><line x1="16.24" x2="19.07" y1="16.24" y2="19.07"/><line x1="2" x2="6" y1="12" y2="12"/><line x1="18" x2="22" y1="12" y2="12"/><line x1="4.93" x2="7.76" y1="19.07" y2="16.24"/><line x1="16.24" x2="19.07" y1="7.76" y2="4.93"/></svg>
                ) : isActive ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                )}
                {preset.label}
              </button>
            );
          })}
        </div>

        {isGenerating ? (
          <div className="loading-overlay delay-3">
            <div className="pulse-ring"></div>
            <p className="loading-text" key={loadingTextIndex}>
              {loadingSentences[loadingTextIndex]}
            </p>
          </div>
        ) : (
          <div className="custom-input-container delay-3">
            <label className="custom-input-label">
              What would you like to improve in your life? State your mission and a custom self hypnosis tape will be created for you.
            </label>
            <div className="custom-input-wrapper">
              <textarea
                className="custom-textarea"
                placeholder="I want to sleep deeply tonight..."
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button 
                className={`submit-btn ${customInput.trim().length > 0 ? 'ready' : ''}`}
                onClick={handleCustomSubmit}
                aria-label="Generate audio"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>
        )}

        {errorMessage && (
          <p className="error-message animate-in">{errorMessage}</p>
        )}

        <footer className="disclaimer animate-in delay-3">
          This experience is for relaxation and personal reflection. It is not a substitute for medical or mental health care.
        </footer>
      </main>
    </>
  );
}
