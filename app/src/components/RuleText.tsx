interface RuleSegment {
  type: 'text' | 'example'
  content: string
}

function splitRuleText(text: string): RuleSegment[] {
  const parts = text.split(/\s+Example:\s+/)
  if (parts.length === 1) return [{ type: 'text', content: text }]

  const segments: RuleSegment[] = []
  const intro = parts[0]?.trim()
  if (intro) segments.push({ type: 'text', content: intro })

  for (const part of parts.slice(1)) {
    const content = part.trim()
    if (content) segments.push({ type: 'example', content })
  }

  return segments
}

export function RuleText({ text }: { text: string }) {
  const segments = splitRuleText(text)

  return (
    <>
      {segments.map((segment, index) =>
        segment.type === 'example' ? (
          <blockquote key={index} className="rule-example">
            <span className="rule-example__label">Example</span>
            {segment.content}
          </blockquote>
        ) : (
          <span key={index}>{segment.content}</span>
        ),
      )}
    </>
  )
}
