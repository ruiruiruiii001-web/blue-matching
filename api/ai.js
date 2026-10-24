export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { prompt } = await req.json();
    const apiKey = process.env.Gemini_API_Key || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Vercelの環境変数 "Gemini_API_Key" が設定されていません。' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. 利用可能なモデルの一覧を取得して確実に動くモデルを自動選出
    const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const modelsData = await modelsRes.json();

    let modelName = 'models/gemini-1.5-flash';
    if (modelsData.models && Array.isArray(modelsData.models)) {
      const available = modelsData.models.find(m => 
        m.supportedGenerationMethods && 
        m.supportedGenerationMethods.includes('generateContent') &&
        (m.name.includes('flash') || m.name.includes('3.8'))
      );
      if (available) {
        modelName = available.name;
      }
    }

    // 2. ストリーミングリクエストを実行（高速化のため maxOutputTokens を設定）
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${modelName}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 800, // 生成文字数を絞り、レスポンス速度を大幅アップ
            temperature: 0.7,
          }
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: `Gemini API Error: ${errText}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        const reader = response.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const jsonStr = line.replace('data: ', '').trim();
                if (jsonStr) {
                  const parsed = JSON.parse(jsonStr);
                  const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (text) {
                    controller.enqueue(encoder.encode(text));
                  }
                }
              }
            }
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: `Server Error: ${error.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
