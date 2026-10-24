export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.Gemini_API_Key || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Vercelの環境変数 "Gemini_API_Key" が設定されていません。' });
  }

  const { prompt } = req.body;

  try {
    // Googleのエラーメッセージが指示している最新モデルを指定
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
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
    return res.status(500).json({ error: `Server Error: ${error.message}` });
  }
}
