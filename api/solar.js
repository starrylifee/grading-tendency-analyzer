// Upstage Solar Pro 3 프록시 — API 키는 Vercel 환경변수(UPSTAGE_API_KEY)에만 존재
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 허용됩니다.' });
  }

  // 같은 사이트에서 온 요청만 허용 — 외부인이 이 엔드포인트로 무료 LLM을 남용하는 것 차단.
  // 브라우저 fetch는 same-origin POST에도 Origin 헤더를 보내므로, 그 host가 배포 host와 같아야 통과.
  const host = req.headers.host || '';
  const originHeader = req.headers.origin || req.headers.referer || '';
  let originOk = false;
  try { originOk = !!originHeader && new URL(originHeader).host === host; } catch (e) { originOk = false; }
  if (!originOk) {
    return res.status(403).json({ error: '이 앱 화면에서만 사용할 수 있습니다.' });
  }

  const { messages, temperature } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 3) {
    return res.status(400).json({ error: 'messages 배열(1~3개)이 필요합니다.' });
  }
  // content는 문자열만 허용 — 객체/배열로 우회해 길이 검사를 피하는 것 방지
  for (const m of messages) {
    if (typeof m.content !== 'string' || typeof m.role !== 'string') {
      return res.status(400).json({ error: 'messages의 role·content는 문자열이어야 합니다.' });
    }
  }
  const totalChars = messages.reduce((s, m) => s + m.content.length, 0);
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
        max_tokens: 8000,
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
