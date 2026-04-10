"use client";

import { useState, useRef, useEffect } from "react";

const loadingSentences = [
  "Rewiring your inner patterns…",
  "Composing your personalized session…",
  "Calming your nervous system…",
  "Shaping supportive inner language…",
  "Preparing your next chapter…",
];

const presets = [
  { id: "sleep", label: "Sleep" },
  { id: "smoking", label: "Smoking" },
  { id: "confidence", label: "Confidence" },
  { id: "relaxation", label: "Relaxation" },
];

export default function Home() {
  const [playingId, setPlayingId] = useState(null);
  const [audioState, setAudioState] = useState("idle");
  const [customInput, setCustomInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const audioRef = useRef(null);

  useEffect(() => {
    let interval;
    if (isGenerating) {
      interval = setInterval(() => {
        setLoadingTextIndex((prev) => (prev + 1) % loadingSentences.length);
      }, 3200);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsInfoOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
        setErrorMessage(`Audio not found. Place /audio/${presetId}.wav in public/audio.`);
      };

      await newAudio.play();
      if (audioRef.current === newAudio) {
        setAudioState("playing");
      } else {
        newAudio.pause();
      }
    } catch (error) {
      console.error("Playback failed", error);
      setAudioState("idle");
      setPlayingId(null);
      setErrorMessage("Playback was interrupted. Please try again.");
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
        body: JSON.stringify({ intent: customInput }),
      });

      if (!res.ok) {
        const errorPayload = await res.json().catch(() => null);
        throw new Error(errorPayload?.detail || errorPayload?.error || "Failed to generate audio. Please try again.");
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

      await generatedAudio.play();
      setIsGenerating(false);
      setAudioState("playing");
    } catch (error) {
      console.error("Custom playback failed", error);
      setIsGenerating(false);
      setPlayingId(null);
      setErrorMessage(error instanceof Error ? error.message : "The session was interrupted. Please softly retry your request.");
    }
  };

  const handleInputKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleCustomSubmit();
    }
  };

  return (
    <>
      <div className="ambient-bg" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      <main className="shell animate-in">
        <nav className="top-nav" aria-label="Primary">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true" />
            <div>
              <p className="brand-title">Glynosis</p>
              <p className="brand-subtitle">Private audio rituals</p>
            </div>
          </div>
          <button className="ghost-btn" onClick={() => setIsInfoOpen(true)}>
            How it works
          </button>
        </nav>

        <header className="hero">
          <p className="eyebrow">Self-hypnosis studio</p>
          <h1>Feel calmer, clearer, and more in control.</h1>
          <p className="hero-copy">
            Choose a guided preset or generate a custom session tailored to your current goal.
          </p>
        </header>

        <section className="panel" aria-labelledby="presets-heading">
          <div className="panel-header">
            <h2 id="presets-heading">Quick sessions</h2>
            <p>Instant playback for common intentions.</p>
          </div>

          <div className="presets-grid">
            {presets.map((preset) => {
              const isActive = playingId === preset.id;
              const isLoading = isActive && audioState === "loading_preset";

              return (
                <button
                  key={preset.id}
                  className={`preset-btn ${isActive ? "active" : ""}`}
                  onClick={() => handlePlayPreset(preset.id)}
                  disabled={isGenerating}
                  aria-pressed={isActive}
                >
                  <span className="preset-icon" aria-hidden="true">
                    {isLoading ? "◌" : isActive ? "▮▮" : "▶"}
                  </span>
                  <span>{preset.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel" aria-labelledby="custom-heading">
          <div className="panel-header">
            <h2 id="custom-heading">Create your own</h2>
            <p>Tell us what you want to shift right now.</p>
          </div>

          {isGenerating ? (
            <div className="loading-overlay" role="status" aria-live="polite">
              <div className="pulse-ring" />
              <p className="loading-text" key={loadingTextIndex}>
                {loadingSentences[loadingTextIndex]}
              </p>
            </div>
          ) : (
            <>
              <div className="custom-input-wrapper">
                <label className="sr-only" htmlFor="intent">
                  What would you like to improve in your life?
                </label>
                <textarea
                  id="intent"
                  className="custom-textarea"
                  placeholder="I want to sleep deeply tonight and wake up refreshed."
                  value={customInput}
                  onChange={(event) => setCustomInput(event.target.value)}
                  onKeyDown={handleInputKeyDown}
                />

                <button
                  className={`submit-btn ${customInput.trim().length > 0 ? "ready" : ""}`}
                  onClick={handleCustomSubmit}
                  aria-label="Generate custom audio"
                >
                  Generate
                </button>
              </div>

              {customInput.trim().length === 0 && !errorMessage && (
                <div className="empty-state">
                  <p>Start with a short intention. Example: “I want to feel calm before sleep.”</p>
                </div>
              )}
            </>
          )}

          {errorMessage && <p className="error-message animate-in">{errorMessage}</p>}
        </section>

        <footer className="disclaimer animate-in">
          This experience supports relaxation and reflection. It is not a substitute for medical or mental health care.
        </footer>
      </main>

      {isInfoOpen && (
        <div className="modal-overlay" role="presentation" onClick={() => setIsInfoOpen(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="modal-title">How Glynosis works</h2>
            <ul>
              <li>Choose a preset for immediate playback.</li>
              <li>Or write your intention for a personalized session.</li>
              <li>Audio is generated and played directly in your browser.</li>
            </ul>
            <button className="ghost-btn" onClick={() => setIsInfoOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
