// Serverless proxy in front of sync.so lipsync. Self-contained on purpose, same
// reasoning as api/studio.ts: cross-file imports fail at load time on Vercel.
//
// Reads SYNC_API_KEY from the deployment environment. The browser never sees it.
//
//   GET  /api/sync?action=health        -> is the key present and accepted?
//   POST /api/sync?action=create        -> {model, input:[{type,url}], options} -> {id}
//   GET  /api/sync?action=status&id=... -> {status, outputUrl, error}

type MinimalRequest = {
  method?: string
  body?: unknown
  query?: Record<string, string | string[] | undefined>
  headers: Record<string, string | string[] | undefined>
}

type MinimalResponse = {
  status: (code: number) => MinimalResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
}

const API_BASE = 'https://api.sync.so'
const ID_RE = /^[A-Za-z0-9_-]{6,64}$/

function key(): string | undefined {
  const k = process.env.SYNC_API_KEY
  return k && k.trim().length > 0 ? k.trim() : undefined
}

async function callSync(path: string, init: RequestInit, k: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'x-api-key': k,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text.slice(0, 400) }
  }
  return { ok: res.ok, status: res.status, data }
}

export default async function handler(req: MinimalRequest, res: MinimalResponse) {
  res.setHeader('Cache-Control', 'no-store')

  const q = req.query || {}
  const raw = q.action
  const action = (Array.isArray(raw) ? raw[0] : raw) || 'health'

  const k = key()

  if (action === 'health') {
    if (!k) {
      return res.status(503).json({
        key_present: false,
        hint: 'Add SYNC_API_KEY in the Vercel project environment variables, then redeploy.',
      })
    }
    // A read that returns 401 for an unauthorised key and 200 for a good one.
    const probe = await callSync('/v2/projects', { method: 'GET' }, k)
    return res.status(200).json({
      key_present: true,
      key_length: k.length,
      authorized: probe.ok,
      upstream_status: probe.status,
      upstream: probe.ok ? undefined : probe.data,
    })
  }

  if (!k) {
    return res.status(503).json({ error: 'SYNC_API_KEY is not set on this deployment.' })
  }

  if (action === 'create') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' })
    const body = (req.body || {}) as Record<string, unknown>
    const model = typeof body.model === 'string' ? body.model : ''
    const input = body.input
    if (!model) return res.status(400).json({ error: 'model is required, e.g. "lipsync-2".' })
    if (!Array.isArray(input) || input.length < 1) {
      return res.status(400).json({ error: 'input must be an array of {type, url} entries.' })
    }
    const payload: Record<string, unknown> = { model, input }
    if (body.options && typeof body.options === 'object') payload.options = body.options
    const out = await callSync('/v2/generate', { method: 'POST', body: JSON.stringify(payload) }, k)
    return res.status(out.ok ? 200 : out.status).json(out.data)
  }

  if (action === 'status') {
    const rawId = q.id
    const id = Array.isArray(rawId) ? rawId[0] : rawId
    if (!id || !ID_RE.test(id)) return res.status(400).json({ error: 'A valid job id is required.' })
    const out = await callSync(`/v2/generate/${id}`, { method: 'GET' }, k)
    return res.status(out.ok ? 200 : out.status).json(out.data)
  }

  return res.status(400).json({ error: `Unknown action: ${action}` })
}
