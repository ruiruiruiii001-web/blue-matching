export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.Gemini_API_Key || process.env.GEMINI_API_KEY || process.env.blue_matching_key;

  if (!apiKey) {
    return res.status(500).json({ error: 'Vercelの環境変数が設定されていません。' });
  }

  const { prompt } = req.body;

  try {
    // 最新の仕様に対応したエンドポイント（gemini-1.5-flash）
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    );

    const data = await response.json();
    
    if (data.error) {
      return res.status(500).json({ error: data.error.message || 'Gemini APIエラー' });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Gemini APIの呼び出しに失敗しました。' });
  }
}
