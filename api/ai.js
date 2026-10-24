export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.Gemini_API_Key || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'DEBUG: Gemini_API_Key 環境変数が取得できません。' });
  }

  const { prompt } = req.body;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      }
    );

    const data = await response.json();
    
    if (data.error) {
      return res.status(500).json({ error: `Gemini API Error: ${data.error.message}` });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: `Catch Error: ${error.message}` });
  }
}
