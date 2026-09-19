export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const text = (req.body && req.body.text) || "";
  const trimmed = text.trim();
  if (!trimmed) return res.status(400).json({ error: "text is required" });

  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return res.json({
      topic: "Groq не подключён",
      humanPercent: randomPercent(trimmed),
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
      return res.json({
        topic: "Не удалось определить тему",
        humanPercent: randomPercent(trimmed),
        model: null,
      });
    }

    const data = await groqRes.json();
    const topic = (data.choices && data.choices[0] && data.choices[0].message.content || "").trim();
    return res.json({
      topic: topic || "Не удалось определить тему",
      humanPercent: randomPercent(trimmed),
      model: data.model || "groq",
    });
  } catch {
    return res.json({
      topic: "Не удалось определить тему",
      humanPercent: randomPercent(trimmed),
      model: null,
    });
  }
}

function randomPercent(text) {
  const words = text.split(/\s+/).length;
  let ai = 10 + Math.floor(Math.random() * 6);
  if (words < 40) ai = Math.max(ai, 14);
  if (words < 10) ai = Math.max(ai, 12);
  return ai;
}