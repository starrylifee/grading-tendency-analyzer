// Upstage Solar Pro 3 프록시 — API 키는 Vercel 환경변수(UPSTAGE_API_KEY)에만 존재
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 허용됩니다.' });
  }

  const { messages, temperature } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages 배열이 필요합니다.' });
  }

  const totalChars = messages.reduce((s, m) => s + (m.content ? String(m.content).length : 0), 0);
  if (totalChars > 200000) {
    return res.status(413).json({ error: '입력이 너무 깁니다.' });
  }

  const key = process.env.UPSTAGE_API_KEY;
  if (!key) {
    return res.status(500).json({ error: '서버에 UPSTAGE_API_KEY가 설정되지 않았습니다.' });
  }

  try {
    const r = await fetch('https://api.upstage.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'solar-pro3',
        messages,
        temperature: typeof temperature === 'number' ? temperature : 0.3,
        stream: false
      })
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json({ error: data?.error?.message || data?.message || 'Upstage API 오류' });
    }

    return res.status(200).json({
      content: data.choices?.[0]?.message?.content ?? '',
      usage: data.usage || null
    });
  } catch (e) {
    return res.status(502).json({ error: 'Upstage API 호출 실패: ' + e.message });
  }
};
