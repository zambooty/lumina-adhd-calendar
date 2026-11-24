/** Keyword recognition for journal entries — ND-friendly themes. */

const KEYWORD_RULES: { keyword: string; patterns: RegExp[] }[] = [
  {
    keyword: 'anxiety',
    patterns: [/\banxious\b/i, /\banxiety\b/i, /\bworr(?:y|ied)\b/i, /\bpanic\b/i],
  },
  {
    keyword: 'focus',
    patterns: [/\bfocus\b/i, /\bhyperfocus\b/i, /\bdistract/i, /\bADHD\b/i],
  },
  {
    keyword: 'rest',
    patterns: [/\brest\b/i, /\bsleep\b/i, /\btired\b/i, /\bnaps?\b/i, /\bexhaust/i],
  },
  {
    keyword: 'energy',
    patterns: [/\benergy\b/i, /\bmotivat/i, /\bdrain/i, /\bspark\b/i],
  },
  {
    keyword: 'gratitude',
    patterns: [/\bgrateful\b/i, /\bgratitude\b/i, /\bthankful\b/i, /\bappreciate/i],
  },
  {
    keyword: 'body',
    patterns: [/\bbody\b/i, /\bmeds?\b/i, /\bpain\b/i, /\bworkout\b/i, /\bwalk\b/i],
  },
  {
    keyword: 'people',
    patterns: [/\bfriend\b/i, /\bfamily\b/i, /\bpartner\b/i, /\blonely\b/i, /\bsocial\b/i],
  },
  {
    keyword: 'win',
    patterns: [/\bwin\b/i, /\bproud\b/i, /\bfinish(?:ed)?\b/i, /\bdone\b/i, /\bprogress\b/i],
  },
  {
    keyword: 'stuck',
    patterns: [/\bstuck\b/i, /\boverwhelm/i, /\bshame\b/i, /\bfail/i, /\b spiral\b/i],
  },
  {
    keyword: 'joy',
    patterns: [/\bjoy\b/i, /\bhapp(?:y|iness)\b/i, /\blaugh/i, /\bfun\b/i, /\bplay\b/i],
  },
]

export function extractKeywords(text: string): string[] {
  const found: string[] = []
  for (const rule of KEYWORD_RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      found.push(rule.keyword)
    }
  }
  return found
}

export function mergeKeywords(
  auto: string[],
  manual: string[],
): string[] {
  const set = new Set(
    [...auto, ...manual]
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean),
  )
  return [...set]
}
