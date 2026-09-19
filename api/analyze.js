export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const text = (req.body && req.body.text) || "";
  const trimmed = text.trim();
  if (!trimmed) return res.status(400).json({ error: "text is required" });

  const key = process.env.GROQ_API_KEY;
  const analysis = realAnalysis(trimmed);

  if (!key) {
    const humanPercent = randomPercent(trimmed);
    return res.json({
      topic: "Groq не подключён",
      humanPercent,
      factors: humanFactors(humanPercent, analysis),
      model: null,
    });
  }

  const sample = trimmed.slice(0, 1200);
  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "groq/compound-mini",
        temperature: 0,
        max_tokens: 30,
        messages: [
          {
            role: "system",
            content: "Определи тему текста в 3–5 словах на русском языке. Верни только тему, без кавычек и пояснений.",
          },
          { role: "user", content: sample },
        ],
      }),
    });

    if (!groqRes.ok) {
      const humanPercent = randomPercent(trimmed);
      return res.json({
        topic: "Не удалось определить тему",
        humanPercent,
        factors: humanFactors(humanPercent, analysis),
        model: null,
      });
    }

    const data = await groqRes.json();
    const topic = (data.choices && data.choices[0] && data.choices[0].message.content || "").trim();
    const humanPercent = randomPercent(trimmed);
    return res.json({
      topic: topic || "Не удалось определить тему",
      humanPercent,
      factors: humanFactors(humanPercent, analysis),
      model: data.model || "groq",
    });
  } catch {
    const humanPercent = randomPercent(trimmed);
    return res.json({
      topic: "Не удалось определить тему",
      humanPercent,
      factors: humanFactors(humanPercent, analysis),
      model: null,
    });
  }
}

function realAnalysis(text) {
  const words = text.split(/[\s.,!?;:()«»"'"\-—]+/).filter(Boolean);
  const wordCount = words.length;
  const uniqWords = new Set(words.map((w) => w.toLowerCase())).size;
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 2);
  const avgSentence = sentences.length ? words.length / sentences.length : words.length;
  const letters = (text.match(/[a-zA-Zа-яА-ЯёЁ]/g) || []).length;
  const commas = (text.match(/[,;:—]/g) || []).length;
  const avgWord = wordCount ? letters / wordCount : 0;

  return { wordCount, uniqShare: wordCount ? uniqWords / wordCount : 0, avgSentence, avgWord, commas };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function humanFactor(score, strength = 1) {
  const noise = (Math.random() - 0.5) * 8;
  return Math.round(clamp(score * (1 - strength) + 100 * strength + noise, 78, 96));
}

function humanFactors(humanPercent, a) {
  const vocabulary = clamp(70 + humanPercent * 0.18 + a.uniqShare * 8 + (Math.random() - 0.5) * 6, 80, 95);
  const syntax = clamp(
    (a.avgSentence >= 8 && a.avgSentence <= 24 ? 84 + humanPercent * 0.1 : 78 + humanPercent * 0.1) +
      Math.min(a.commas, 12) * 0.4 + (Math.random() - 0.5) * 5,
    78,
    95
  );
  const style = clamp(
    a.avgWord > 4 && a.avgWord < 7 ? 85 + humanPercent * 0.1 : 80 + humanPercent * 0.1 + (Math.random() - 0.5) * 6,
    78,
    96
  );

  return [
    { label: "Стилистическая близость", value: Math.round(clamp(style, 79, 96)), kind: "human" },
    { label: "Словарное разнообразие", value: Math.round(clamp(vocabulary, 79, 96)), kind: "human" },
    { label: "Синтаксическая структура", value: Math.round(clamp(syntax, 78, 96)), kind: "human" },
  ];
}

function randomPercent(text) {
  const words = text.split(/\s+/).length;
  let ai = 10 + Math.floor(Math.random() * 6);
  if (words < 40) ai = Math.max(ai, 14);
  if (words < 10) ai = Math.max(ai, 12);
  return ai;
}