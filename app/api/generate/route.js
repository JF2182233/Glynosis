import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are an expert self-hypnosis and guided meditation script writer.
Write calming, emotionally intelligent, second-person scripts that are soothing, elegant, and simple to listen to.
The tone should be warm, safe, encouraging, slow, and quietly powerful.
Do not sound robotic, salesy, cheesy, mystical, or over-the-top.
Avoid clinical claims, diagnosis language, or guaranteed outcomes.
Do not mention being an AI.
The script should feel like a premium guided self-hypnosis recording.
Structure:
1. Gentle settling / breath
2. Light body relaxation
3. Suggestive reframing around the user’s goal
4. Positive identity statements
5. Future pacing / inner confidence
6. Soft closing
Length target:
Roughly 600–1000 words depending on the request.
Keep sentences pleasant to hear spoken aloud.

For smoking-related requests:
- frame around freedom, calm, self-respect, and detachment from cravings
- avoid shame or harshness

For sleep-related requests:
- slower cadence
- more drifting imagery
- softer closing

For confidence-related requests:
- grounded strength, calm certainty, self-trust

For relaxation-related requests:
- release tension, safety, calm nervous system tone

For custom user requests:
- infer the underlying emotional need and write the script around it`;

function pcmToWav(pcmBuffer, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmBuffer.length;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(buffer, 44);

  return buffer;
}

function parseMimeConfig(mimeType = "") {
  const normalized = mimeType.toLowerCase();

  const readIntParam = (paramName, fallback) => {
    const match = normalized.match(new RegExp(`${paramName}\\s*=\\s*(\\d+)`));
    return Number.parseInt(match?.[1] ?? "", 10) || fallback;
  };

  return {
    mimeType: normalized,
    sampleRate: readIntParam("rate", 24000),
    channels: readIntParam("channels", 1),
    bitsPerSample: readIntParam("bits", 16),
  };
}

function isRawPcmMime(mimeType = "") {
  const normalized = mimeType.toLowerCase();
  return ["audio/l16", "audio/pcm", "audio/raw", "audio/linear16"].some((token) => normalized.includes(token));
}

function jsonError(message, status, detail) {
  return NextResponse.json({ error: message, detail }, { status });
}

export async function POST(req) {
  try {
    const { intent } = await req.json();

    if (!process.env.GROQ_API_KEY) {
      return jsonError("Server is missing GROQ_API_KEY.", 500, "Set GROQ_API_KEY in your environment.");
    }

    if (!process.env.GEMINI_API_KEY) {
      return jsonError("Server is missing GEMINI_API_KEY.", 500, "Set GEMINI_API_KEY in your environment.");
    }

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: intent || "I want to relax" },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    const groqData = await groqRes.json();
    if (!groqRes.ok) {
      return jsonError("Groq request failed.", groqRes.status, groqData?.error?.message || "Unknown Groq error");
    }

    const script = groqData.choices?.[0]?.message?.content;
    if (!script?.trim()) {
      return jsonError("Script generation failed.", 502, "Groq returned an empty script.");
    }

    const geminiRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: script }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: "Kore",
                },
              },
            },
          },
          model: "gemini-2.5-flash-preview-tts",
        }),
      }
    );

    const geminiData = await geminiRes.json();
    if (!geminiRes.ok) {
      return jsonError("Gemini TTS request failed.", geminiRes.status, geminiData?.error?.message || "Unknown Gemini error");
    }

    const inlineData = geminiData.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inlineData?.data) {
      return jsonError("Gemini returned no audio data.", 502, "Expected candidates[0].content.parts[0].inlineData.data");
    }

    const rawAudioBuffer = Buffer.from(inlineData.data, "base64");
    const mimeDetails = parseMimeConfig(inlineData.mimeType || "audio/L16;rate=24000");
    const audioBuffer = isRawPcmMime(mimeDetails.mimeType)
      ? pcmToWav(rawAudioBuffer, mimeDetails.sampleRate, mimeDetails.channels, mimeDetails.bitsPerSample)
      : rawAudioBuffer;

    return NextResponse.json({
      transcript: script,
      mimeType: isRawPcmMime(mimeDetails.mimeType) ? "audio/wav" : mimeDetails.mimeType,
      audioBase64: audioBuffer.toString("base64"),
    });
  } catch (error) {
    console.error("Audio generation failed:", error);
    return jsonError("Generation failed.", 500, error instanceof Error ? error.message : "Unknown server error");
  }
}
