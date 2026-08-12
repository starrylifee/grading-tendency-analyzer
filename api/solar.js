// Upstage Solar Pro 3 프록시 — API 키는 Vercel 환경변수(UPSTAGE_API_KEY)에만 존재
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 허용됩니다.' });
  }

  // 이 앱 도메인에서 온 브라우저 요청만 허용 — 외부인의 무료 LLM 남용 차단.
  // Origin은 클라이언트가 보내는 값이라 위조 가능하지만(완전 차단은 레이트리밋/서명 필요),
  // 클라이언트가 준 Host와 비교하는 대신 서버가 아는 배포 도메인 화이트리스트와 대조해 Host 위조 벡터는 막는다.
  const originHeader = req.headers.origin || req.headers.referer || '';
  let originOk = false;
  try {
    const oh = new URL(originHeader).host;
    originOk = oh === 'grading-tendency-analyzer.vercel.app'
      || /^grading-tendency-analyzer[a-z0-9-]*\.vercel\.app$/.test(oh)  // 프리뷰 배포
      || /^localhost(:\d+)?$/.test(oh);                                  // 로컬 개발
  } catch (e) { originOk = false; }
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
