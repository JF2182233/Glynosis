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
  const [hasEnteredFlow, setHasEnteredFlow] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const [audioState, setAudioState] = useState("idle");
  const [customInput, setCustomInput] = useState("");
  const [transcript, setTranscript] = useState("");
  const [currentAudioSrc, setCurrentAudioSrc] = useState("");
  const [currentAudioLabel, setCurrentAudioLabel] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const audioRef = useRef(null);
  const generatedUrlRef = useRef(null);

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

  const clearGeneratedUrl = () => {
    if (generatedUrlRef.current) {
      URL.revokeObjectURL(generatedUrlRef.current);
      generatedUrlRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearGeneratedUrl();
    };
  }, []);

  const playSource = async ({ src, id, label, transcriptText = "" }) => {
    if (!audioRef.current) return;

    const player = audioRef.current;
    player.src = src;
    await player.play();

    setPlayingId(id);
    setCurrentAudioSrc(src);
    setCurrentAudioLabel(label);
    setTranscript(transcriptText);
    setAudioState("playing");
  };

  const base64ToBlob = (base64Data, mimeType) => {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i += 1) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new Blob([bytes], { type: mimeType });
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
    clearGeneratedUrl();
    setIsGenerating(false);
    setAudioState("loading_preset");

    try {
      await playSource({
        src: `/audio/${presetId}.wav`,
        id: presetId,
        label: `${presetId[0].toUpperCase()}${presetId.slice(1)} preset`,
      });
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
    clearGeneratedUrl();
    setPlayingId("custom");
    setAudioState("idle");
    setIsGenerating(true);
    setTranscript("");
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

      const payload = await res.json();
      const blob = base64ToBlob(payload.audioBase64, payload.mimeType || "audio/wav");
      const url = URL.createObjectURL(blob);
      generatedUrlRef.current = url;

      await playSource({
        src: url,
        id: "custom",
        label: "Custom session",
        transcriptText: payload.transcript || "",
      });

      setIsGenerating(false);
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

      {hasEnteredFlow ? (
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

        {transcript && (
          <section className="panel transcript-panel animate-in" aria-labelledby="transcript-heading">
            <div className="panel-header">
              <h2 id="transcript-heading">Transcript</h2>
              <p>Read along while you listen.</p>
            </div>
            <div className="transcript-body">{transcript}</div>
          </section>
        )}

        <footer className="disclaimer animate-in">
          This experience supports relaxation and reflection. It is not a substitute for medical or mental health care.
        </footer>
      </main>
      ) : (
        <section className="landing-screen animate-in" role="dialog" aria-labelledby="landing-title" aria-modal="true">
          <div className="landing-card">
            <p className="landing-brand">Glynosis</p>
            <h1 id="landing-title">Your path to self improvement through hypnosis and meditation.</h1>
            <p className="landing-copy">
              Just set your goal and Glynosis will rewire your mind to achieve it!
            </p>
            <button className="flowstate-btn" onClick={() => setHasEnteredFlow(true)}>
              Enter flowstate
            </button>
          </div>
        </section>
      )}

      <div className={`floating-player ${currentAudioSrc ? "is-visible animate-in" : ""}`}>
        <p className="player-label">{currentAudioLabel || "Now playing"}</p>
        <audio
          ref={audioRef}
          controls
          onEnded={() => {
            setAudioState("idle");
            setPlayingId(null);
          }}
          onPause={() => {
            if (!audioRef.current?.ended) {
              setAudioState("idle");
            }
          }}
          onPlay={() => setAudioState("playing")}
          onError={() => {
            setAudioState("idle");
            setPlayingId(null);
            setErrorMessage("Audio not found or unsupported in this browser.");
          }}
        />
      </div>

      {isGenerating && (
        <aside className="generation-popup animate-in" role="status" aria-live="polite">
          <p className="generation-popup-title">Advanced AI is perfecting your script ✨</p>
          <p>
            It&apos;s crafting something that deeply connects you with your goal. This can take up to 90 seconds, so
            just relax.
          </p>
        </aside>
      )}

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
