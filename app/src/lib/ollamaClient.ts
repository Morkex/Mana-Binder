const OLLAMA_BASE = 'http://127.0.0.1:11434'
export const DEFAULT_OLLAMA_MODEL = 'qwen2.5:14b'

export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(2500) })
    return res.ok
  } catch {
    return false
  }
}

export async function listOllamaModels(): Promise<string[]> {
  const res = await fetch(`${OLLAMA_BASE}/api/tags`)
  if (!res.ok) throw new Error(`Ollama no responde (${res.status})`)
  const data = (await res.json()) as { models?: { name: string }[] }
  return (data.models ?? []).map((m) => m.name)
}

export async function ollamaChat(params: {
  model?: string
  system: string
  prompt: string
  temperature?: number
  numPredict?: number
}): Promise<string> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 180_000)

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: params.model ?? DEFAULT_OLLAMA_MODEL,
        stream: false,
        format: 'json',
        options: {
          temperature: params.temperature ?? 0.55,
          num_predict: params.numPredict ?? 2200,
        },
        messages: [
          { role: 'system', content: params.system },
          { role: 'user', content: params.prompt },
        ],
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Ollama error ${res.status}: ${body.slice(0, 200)}`)
    }

    const data = (await res.json()) as { message?: { content?: string } }
    const content = data.message?.content?.trim()
    if (!content) throw new Error('Ollama devolvió una respuesta vacía')
    return content
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Ollama tardó demasiado (timeout 3 min)')
    }
    throw err
  } finally {
    window.clearTimeout(timeout)
  }
}
