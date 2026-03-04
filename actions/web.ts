/**
 * Web actions — fetch and search the internet.
 *
 * fetch_page: retrieve a URL and return its text content
 * web_search: search the internet via DuckDuckGo
 */

// --- Tool definitions ---

export const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'fetch_page',
      description:
        'Fetch a web page and return its text content. HTML is stripped to readable text. ' +
        'Use this to read articles, documentation, APIs, etc.',
      parameters: {
        type: 'object' as const,
        properties: {
          url: { type: 'string', description: 'The URL to fetch' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'web_search',
      description:
        'Search the internet using DuckDuckGo. Returns a list of results with titles, URLs, and snippets. ' +
        'Use fetch_page to read full content of interesting results.',
      parameters: {
        type: 'object' as const,
        properties: {
          query: { type: 'string', description: 'The search query' },
        },
        required: ['query'],
      },
    },
  },
]

// --- Handler ---

/** Strip HTML tags and decode common entities, returning readable text. */
function htmlToText(html: string): string {
  // Remove script/style blocks
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '')
  // Replace block-level tags with newlines
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|br\s*\/?)>/gi, '\n')
  text = text.replace(/<br\s*\/?>/gi, '\n')
  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, '')
  // Decode common entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
  // Collapse whitespace
  text = text.replace(/[ \t]+/g, ' ')
  text = text.replace(/\n{3,}/g, '\n\n')
  return text.trim()
}

const MAX_LENGTH = 12_000 // keep responses manageable for the LLM

const FETCH_HEADERS = {
  'User-Agent': 'NanoClaw/1.0 (AI Agent)',
  'Accept': 'text/html, application/json, text/plain',
}

/** Fetch a URL and return cleaned text. */
async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: FETCH_HEADERS,
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    return `Error: HTTP ${response.status} ${response.statusText}`
  }

  const contentType = response.headers.get('content-type') || ''
  const raw = await response.text()

  let text: string
  if (contentType.includes('application/json')) {
    try { text = JSON.stringify(JSON.parse(raw), null, 2) } catch { text = raw }
  } else if (contentType.includes('text/html')) {
    text = htmlToText(raw)
  } else {
    text = raw
  }

  if (text.length > MAX_LENGTH) {
    text = text.slice(0, MAX_LENGTH) + '\n\n… (truncated)'
  }
  return text
}

interface SearchResult { title: string; url: string; snippet: string }

/** Search DuckDuckGo HTML and parse results. */
async function webSearch(query: string): Promise<string> {
  const params = new URLSearchParams({ q: query })
  const response = await fetch(`https://html.duckduckgo.com/html/?${params}`, {
    headers: {
      'User-Agent': 'NanoClaw/1.0 (AI Agent)',
      'Accept': 'text/html',
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    return `Error: HTTP ${response.status} ${response.statusText}`
  }

  const html = await response.text()
  const results: SearchResult[] = []

  // Parse result blocks: each result lives in a <div class="result...">
  const resultBlocks = html.match(/<div[^>]*class="[^"]*result[^"]*"[\s\S]*?<\/div>\s*<\/div>/gi) || []
  for (const block of resultBlocks) {
    // Extract title and URL from the result link
    const linkMatch = block.match(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/)
    if (!linkMatch) continue

    let url = linkMatch[1]
    const title = htmlToText(linkMatch[2]).trim()

    // DuckDuckGo wraps URLs in a redirect — extract the real URL
    const uddg = url.match(/uddg=([^&]+)/)
    if (uddg) url = decodeURIComponent(uddg[1])

    // Extract snippet
    const snippetMatch = block.match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/)
    const snippet = snippetMatch ? htmlToText(snippetMatch[1]).trim() : ''

    if (title && url) results.push({ title, url, snippet })
    if (results.length >= 10) break
  }

  if (results.length === 0) return 'No results found.'

  return results
    .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
    .join('\n\n')
}

export function createHandler(): (name: string, args: Record<string, string>) => Promise<string | null> {
  return async (name, args) => {
    try {
      if (name === 'fetch_page') {
        if (!args.url) return 'Error: url is required'
        return fetchPage(args.url)
      }
      if (name === 'web_search') {
        if (!args.query) return 'Error: query is required'
        return webSearch(args.query)
      }
      return null
    } catch (e: any) {
      return `Error: ${e.message}`
    }
  }
}
