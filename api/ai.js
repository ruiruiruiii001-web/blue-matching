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
    // 1. まず利用可能なモデル一覧を取得
    const modelsResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const modelsData = await modelsResponse.json();

    if (modelsData.error) {
      return res.status(500).json({ error: `API Key Validation Error: ${modelsData.error.message}` });
    }

    // generateContentに対応しているモデルを自動検出
    const validModel = modelsData.models?.find(m => 
      m.supportedGenerationMethods?.includes('generateContent')
    );

    if (!validModel) {
      return res.status(500).json({ 
        error: '利用可能なGeminiモデルが見つかりませんでした。APIキーの権限を確認してください。',
        availableModels: modelsData 
      });
    }

    // 2. 検出された有効なモデル名で呼び出しを実行
    const targetModel = validModel.name; // 例: "models/gemini-1.5-flash"
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${targetModel}:generateContent?key=${apiKey}`,
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
