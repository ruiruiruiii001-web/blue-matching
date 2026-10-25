import Anthropic from '@anthropic-ai/sdk';

// Vercel Edge Runtime を使う場合の設定（もし通常のServerlessにする場合はこの行を削除してください）
export const config = {
  runtime: 'edge',
};

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'プロンプトがありません。' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Claude API リクエスト
    // max_tokens を短め（例: 400）にすることで、タイムアウト（10〜15秒の壁）を確実に回避します
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241007', // より高速で軽量な Haiku モデルを使用するとさらにタイムアウトしにくくなります
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const replyText = response.content[0].text;

    return new Response(JSON.stringify({ result: replyText }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
