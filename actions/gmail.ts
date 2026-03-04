/**
 * Gmail actions — read-only email access via Gmail REST API.
 *
 * search_emails: search inbox with Gmail query syntax
 * read_email: read full email body by message ID
 *
 * Requires GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN in env.
 */

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

// --- Tool definitions ---

export const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'search_emails',
      description:
        'Search Gmail using query syntax (e.g. "from:alice subject:invoice after:2024/01/01"). ' +
        'Returns a list of matching emails with IDs, snippets, subject, from, and date.',
      parameters: {
        type: 'object' as const,
        properties: {
          query: { type: 'string', description: 'Gmail search query' },
          max_results: { type: 'string', description: 'Max results to return (default 10, max 50)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'read_email',
      description:
        'Read the full body of an email by its message ID. Returns plain text content, ' +
        'with subject, from, to, and date headers.',
      parameters: {
        type: 'object' as const,
        properties: {
          message_id: { type: 'string', description: 'The Gmail message ID (from search_emails results)' },
        },
        required: ['message_id'],
      },
    },
  },
]

// --- Token cache ---

let cachedToken: { accessToken: string; expiresAt: number } | null = null

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.accessToken
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Token refresh failed (${response.status}): ${text}`)
  }

  const data = await response.json() as { access_token: string; expires_in: number }
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  return cachedToken.accessToken
}

// --- Helpers ---

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''
}

/** Decode base64url-encoded string to UTF-8 text. */
function decodeBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64').toString('utf-8')
}

/** Strip HTML tags to plain text. */
function stripHtml(html: string): string {
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '')
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|br\s*\/?)>/gi, '\n')
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<[^>]+>/g, '')
  text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
  text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
  return text.trim()
}

/** Extract plain text body from a Gmail message payload. */
function extractBody(payload: any): string {
  // Direct body (simple messages)
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }

  // Multipart — walk parts looking for text/plain first, then text/html
  if (payload.parts) {
    let htmlBody = ''
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data)
      }
      if (part.mimeType === 'text/html' && part.body?.data) {
        htmlBody = decodeBase64Url(part.body.data)
      }
      // Nested multipart (e.g. multipart/alternative inside multipart/mixed)
      if (part.parts) {
        const nested = extractBody(part)
        if (nested) return nested
      }
    }
    if (htmlBody) return stripHtml(htmlBody)
  }

  // Fallback: HTML body at top level
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return stripHtml(decodeBase64Url(payload.body.data))
  }

  return '(no readable body)'
}

// --- Handler ---

const MAX_BODY_LENGTH = 12_000

export function createHandler(): (name: string, args: Record<string, string>) => Promise<string | null> {
  return async (name, args) => {
    if (name !== 'search_emails' && name !== 'read_email') return null

    const clientId = process.env.GMAIL_CLIENT_ID
    const clientSecret = process.env.GMAIL_CLIENT_SECRET
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN

    if (!clientId || !clientSecret || !refreshToken) {
      return 'Error: Gmail credentials not configured. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN in .env.local'
    }

    try {
      const token = await getAccessToken(clientId, clientSecret, refreshToken)
      const headers = { Authorization: `Bearer ${token}` }

      if (name === 'search_emails') {
        const { query } = args
        if (!query) return 'Error: query is required'

        const maxResults = Math.min(parseInt(args.max_results || '10', 10) || 10, 50)

        // List matching message IDs
        const listUrl = `${GMAIL_API}/messages?${new URLSearchParams({ q: query, maxResults: String(maxResults) })}`
        const listRes = await fetch(listUrl, { headers, signal: AbortSignal.timeout(15_000) })
        if (!listRes.ok) return `Error: Gmail API ${listRes.status} — ${await listRes.text()}`

        const listData = await listRes.json() as { messages?: Array<{ id: string }>; resultSizeEstimate?: number }
        if (!listData.messages?.length) return 'No emails found matching that query.'

        // Fetch metadata for each message
        const results = await Promise.all(
          listData.messages.map(async (msg) => {
            const msgUrl = `${GMAIL_API}/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`
            const msgRes = await fetch(msgUrl, { headers, signal: AbortSignal.timeout(10_000) })
            if (!msgRes.ok) return { id: msg.id, error: `HTTP ${msgRes.status}` }
            const msgData = await msgRes.json() as { id: string; snippet: string; payload?: { headers: Array<{ name: string; value: string }> } }
            const hdrs = msgData.payload?.headers || []
            return {
              id: msgData.id,
              subject: getHeader(hdrs, 'Subject'),
              from: getHeader(hdrs, 'From'),
              date: getHeader(hdrs, 'Date'),
              snippet: msgData.snippet,
            }
          }),
        )

        const lines = results.map((r: any) =>
          r.error
            ? `- [${r.id}] (error: ${r.error})`
            : `- [${r.id}] ${r.date}\n  From: ${r.from}\n  Subject: ${r.subject}\n  ${r.snippet}`,
        )
        return `Found ${results.length} email(s):\n\n${lines.join('\n\n')}`
      }

      if (name === 'read_email') {
        const { message_id } = args
        if (!message_id) return 'Error: message_id is required'

        const msgUrl = `${GMAIL_API}/messages/${message_id}?format=full`
        const msgRes = await fetch(msgUrl, { headers, signal: AbortSignal.timeout(15_000) })
        if (!msgRes.ok) return `Error: Gmail API ${msgRes.status} — ${await msgRes.text()}`

        const msgData = await msgRes.json() as any
        const hdrs = msgData.payload?.headers || []

        let body = extractBody(msgData.payload)
        if (body.length > MAX_BODY_LENGTH) {
          body = body.slice(0, MAX_BODY_LENGTH) + '\n\n… (truncated)'
        }

        return [
          `Subject: ${getHeader(hdrs, 'Subject')}`,
          `From: ${getHeader(hdrs, 'From')}`,
          `To: ${getHeader(hdrs, 'To')}`,
          `Date: ${getHeader(hdrs, 'Date')}`,
          '',
          body,
        ].join('\n')
      }

      return null
    } catch (e: any) {
      return `Error: ${e.message}`
    }
  }
}
