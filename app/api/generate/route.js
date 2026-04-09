import { NextResponse } from 'next/server';

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

export async function POST(req) {
  try {
    const { intent } = await req.json();

    // 1. Groq Generation
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: intent || "I want to relax" }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      })
    });
    
    const groqData = await groqRes.json();
    if (!groqRes.ok) throw new Error(groqData.error?.message || "Groq error");
    
    const script = groqData.choices[0]?.message?.content || "";

    // 2. Gemini TTS Generation
    const aiKey = process.env.GEMINI_API_KEY;
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-tts:generateContent?key=${aiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: script }] }]
      })
    });

    const geminiData = await geminiRes.json();
    if (!geminiRes.ok) throw new Error(geminiData.error?.message || "Gemini TTS error");

    const inlineData = geminiData.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inlineData || !inlineData.data) {
      throw new Error("No audio data returned from Gemini");
    }

    const audioBuffer = Buffer.from(inlineData.data, 'base64');

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': inlineData.mimeType || 'audio/wav',
        'Content-Length': audioBuffer.length.toString()
      }
    });

  } catch (err) {
    console.error("Audio generation failed:", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
