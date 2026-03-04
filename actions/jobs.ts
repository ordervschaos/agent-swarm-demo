/**
 * Job board API actions — structured job data from public APIs.
 *
 * Free (no key):
 *   search_remotive:  Remote jobs from Remotive (category/keyword filter)
 *   search_remoteok:  Remote jobs from RemoteOK (tag-based filtering)
 *   search_jobicy:    Remote jobs from Jobicy (geo/level/tag filters)
 *   search_hn_hiring: Hacker News "Who is Hiring" threads via Algolia
 *
 * Keyed (free tier):
 *   search_jsearch:   LinkedIn/Indeed/Glassdoor via RapidAPI (200 free req/mo)
 *   search_adzuna:    16+ countries, salary data (free registration)
 *   search_jooble:    Global aggregator (free registration)
 */

import type { ChatCompletionTool } from 'openai/resources/index'

// --- Tool definitions ---

export const tools: ChatCompletionTool[] = [
  {
    type: 'function' as const,
    function: {
      name: 'search_remotive',
      description:
        'Search Remotive.com for remote jobs. Returns structured JSON with title, company, location, salary, description, and URL. ' +
        'Rate limit: keep to a few calls per session.',
      parameters: {
        type: 'object' as const,
        properties: {
          search: { type: 'string', description: 'Keyword to search for (e.g. "react", "node.js", "staff engineer")' },
          category: {
            type: 'string',
            description:
              'Job category slug. Options: software-dev, design, frontend-dev, backend-dev, devops, qa, ' +
              'data, product, machine-learning-ai, customer-support, marketing, sales, all-others',
          },
          limit: { type: 'number', description: 'Max results to return (default 20, max 50)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_remoteok',
      description:
        'Fetch remote jobs from RemoteOK.com. Returns full listing with tags, salary range, company, and apply URL. ' +
        'Optionally filter by tags client-side. No query params — returns all recent jobs.',
      parameters: {
        type: 'object' as const,
        properties: {
          tags: {
            type: 'string',
            description: 'Comma-separated tags to filter by (e.g. "react,typescript,node"). Matched against each job\'s tags array.',
          },
          limit: { type: 'number', description: 'Max results to return (default 30)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_jobicy',
      description:
        'Search Jobicy.com for remote jobs. Best API for seniority filtering — has jobLevel field. ' +
        'Supports geo and industry filters. Rate limit: max 1 request per hour.',
      parameters: {
        type: 'object' as const,
        properties: {
          count: { type: 'number', description: 'Number of results (default 20, max 50)' },
          geo: {
            type: 'string',
            description: 'Geographic filter (e.g. "anywhere", "usa", "india", "europe")',
          },
          industry: {
            type: 'string',
            description: 'Industry filter (e.g. "tech", "marketing", "design")',
          },
          tag: {
            type: 'string',
            description: 'Tech tag to filter by (e.g. "javascript", "react", "python", "nodejs")',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_hn_hiring',
      description:
        'Search Hacker News "Who is Hiring" threads via Algolia API. Returns individual job comments from the monthly thread. ' +
        'Each comment is free-form text — you will need to parse company, role, location, and stack from the text.',
      parameters: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Search within job comments (e.g. "remote typescript react", "senior node.js")',
          },
          month: {
            type: 'string',
            description: 'Month to search (e.g. "2026-03"). Defaults to current month.',
          },
        },
        required: [],
      },
    },
  },

  // --- Keyed APIs (free tier) ---

  {
    type: 'function' as const,
    function: {
      name: 'search_jsearch',
      description:
        'Search jobs aggregated from LinkedIn, Indeed, Glassdoor, ZipRecruiter via Google Jobs (RapidAPI JSearch). ' +
        'Rich data: full descriptions, salary ranges, required skills. Requires JSEARCH_API_KEY in env. ' +
        'Free tier: 200 requests/month.',
      parameters: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Search query (e.g. "senior react developer remote", "typescript engineer india")',
          },
          remote_jobs_only: {
            type: 'boolean',
            description: 'Only return remote jobs (default true)',
          },
          num_pages: {
            type: 'number',
            description: 'Number of pages to return (default 1, each page ~10 results)',
          },
          date_posted: {
            type: 'string',
            description: 'Filter by posting age: "today", "3days", "week", "month", "all"',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_adzuna',
      description:
        'Search jobs on Adzuna across 16+ countries. Good for volume and salary data. ' +
        'Requires ADZUNA_APP_ID and ADZUNA_APP_KEY in env. Free registration at developer.adzuna.com.',
      parameters: {
        type: 'object' as const,
        properties: {
          what: {
            type: 'string',
            description: 'Keywords to search for (e.g. "react typescript senior")',
          },
          where: {
            type: 'string',
            description: 'Location (e.g. "remote", "london", "new york")',
          },
          country: {
            type: 'string',
            description: 'Country code: us, gb, in, de, fr, au, ca, nl, etc. (default "us")',
          },
          results_per_page: {
            type: 'number',
            description: 'Results per page (default 20, max 50)',
          },
          salary_min: {
            type: 'number',
            description: 'Minimum annual salary filter',
          },
        },
        required: ['what'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_jooble',
      description:
        'Search jobs on Jooble — a global aggregator covering 71 countries. ' +
        'Requires JOOBLE_API_KEY in env. Free registration at jooble.org/api/about.',
      parameters: {
        type: 'object' as const,
        properties: {
          keywords: {
            type: 'string',
            description: 'Search keywords (e.g. "senior typescript react remote")',
          },
          location: {
            type: 'string',
            description: 'Location filter (e.g. "remote", "India", "worldwide")',
          },
          salary: {
            type: 'number',
            description: 'Minimum salary filter',
          },
          page: {
            type: 'number',
            description: 'Page number (default 1)',
          },
        },
        required: ['keywords'],
      },
    },
  },
]

// --- Shared helpers ---

const FETCH_HEADERS = {
  'User-Agent': 'NanoClaw/1.0 (AI Agent)',
  Accept: 'application/json',
}

const MAX_RESPONSE = 15_000

function truncate(text: string): string {
  return text.length > MAX_RESPONSE ? text.slice(0, MAX_RESPONSE) + '\n\n… (truncated)' : text
}

// --- Remotive ---

interface RemotiveJob {
  id: number
  url: string
  title: string
  company_name: string
  category: string
  job_type: string
  publication_date: string
  candidate_required_location: string
  salary: string
  description: string
}

async function searchRemotive(args: Record<string, string>): Promise<string> {
  const params = new URLSearchParams()
  if (args.search) params.set('search', args.search)
  if (args.category) params.set('category', args.category)
  const limit = Math.min(Number(args.limit) || 20, 50)
  params.set('limit', String(limit))

  const res = await fetch(`https://remotive.com/api/remote-jobs?${params}`, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) return `Error: HTTP ${res.status} ${res.statusText}`

  const data = await res.json() as { jobs: RemotiveJob[] }
  const jobs = data.jobs.map(j => ({
    title: j.title,
    company: j.company_name,
    location: j.candidate_required_location || 'Remote',
    url: j.url,
    source: 'Remotive',
    category: j.category,
    type: j.job_type,
    salary: j.salary || null,
    published: j.publication_date,
    description_preview: stripHtml(j.description).slice(0, 500),
  }))

  return truncate(JSON.stringify(jobs, null, 2))
}

// --- RemoteOK ---

interface RemoteOKJob {
  slug: string
  id: string
  date: string
  company: string
  company_logo: string
  position: string
  tags: string[]
  description: string
  location: string
  salary_min: number
  salary_max: number
  apply_url: string
  url: string
}

async function searchRemoteOK(args: Record<string, string>): Promise<string> {
  const res = await fetch('https://remoteok.com/api', {
    headers: { ...FETCH_HEADERS, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) return `Error: HTTP ${res.status} ${res.statusText}`

  // First element is metadata, skip it
  const raw = await res.json() as RemoteOKJob[]
  let jobs = raw.slice(1)

  // Filter by tags if provided
  const filterTags = args.tags
    ? args.tags.split(',').map(t => t.trim().toLowerCase())
    : []

  if (filterTags.length > 0) {
    jobs = jobs.filter(j =>
      j.tags && filterTags.some(ft => j.tags.map(t => t.toLowerCase()).includes(ft)),
    )
  }

  const limit = Math.min(Number(args.limit) || 30, 50)
  jobs = jobs.slice(0, limit)

  const formatted = jobs.map(j => ({
    title: j.position,
    company: j.company,
    location: j.location || 'Remote',
    url: j.url || `https://remoteok.com/remote-jobs/${j.slug}`,
    apply_url: j.apply_url || null,
    source: 'RemoteOK',
    tags: j.tags,
    salary_min: j.salary_min || null,
    salary_max: j.salary_max || null,
    date: j.date,
    description_preview: stripHtml(j.description || '').slice(0, 500),
  }))

  return truncate(JSON.stringify(formatted, null, 2))
}

// --- Jobicy ---

interface JobicyJob {
  id: number
  url: string
  jobTitle: string
  companyName: string
  companyLogo: string
  jobIndustry: string[]
  jobType: string[]
  jobGeo: string
  jobLevel: string
  jobExcerpt: string
  jobDescription: string
  pubDate: string
  annualSalaryMin: string
  annualSalaryMax: string
  salaryCurrency: string
}

async function searchJobicy(args: Record<string, string>): Promise<string> {
  const params = new URLSearchParams()
  params.set('count', String(Math.min(Number(args.count) || 20, 50)))
  if (args.geo) params.set('geo', args.geo)
  if (args.industry) params.set('industry', args.industry)
  if (args.tag) params.set('tag', args.tag)

  const res = await fetch(`https://jobicy.com/api/v2/remote-jobs?${params}`, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) return `Error: HTTP ${res.status} ${res.statusText}`

  const data = await res.json() as { jobs: JobicyJob[] }
  const jobs = (data.jobs || []).map(j => ({
    title: j.jobTitle,
    company: j.companyName,
    location: j.jobGeo || 'Remote',
    level: j.jobLevel,
    url: j.url,
    source: 'Jobicy',
    industry: j.jobIndustry,
    type: j.jobType,
    salary_min: j.annualSalaryMin || null,
    salary_max: j.annualSalaryMax || null,
    salary_currency: j.salaryCurrency || null,
    published: j.pubDate,
    description_preview: stripHtml(j.jobExcerpt || j.jobDescription || '').slice(0, 500),
  }))

  return truncate(JSON.stringify(jobs, null, 2))
}

// --- HN Who is Hiring (Algolia) ---

interface HNHit {
  objectID: string
  story_id: number
  parent_id: number
  comment_text: string
  author: string
  created_at: string
}

interface HNStoryHit {
  objectID: string
  title: string
  created_at: string
}

async function searchHNHiring(args: Record<string, string>): Promise<string> {
  // Step 1: Find the "Who is Hiring" thread for the target month
  const now = new Date()
  const month = args.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Search for the monthly thread
  const threadParams = new URLSearchParams({
    query: `Ask HN: Who is hiring? (${formatMonth(month)})`,
    tags: 'story,ask_hn',
    hitsPerPage: '5',
  })

  const threadRes = await fetch(`https://hn.algolia.com/api/v1/search?${threadParams}`, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(15_000),
  })

  if (!threadRes.ok) return `Error finding thread: HTTP ${threadRes.status}`

  const threadData = await threadRes.json() as { hits: HNStoryHit[] }
  const thread = threadData.hits.find(h =>
    h.title.toLowerCase().includes('who is hiring'),
  )

  if (!thread) return `No "Who is Hiring" thread found for ${month}.`

  // Step 2: Search within that thread's comments
  const query = args.query || 'remote'
  const commentParams = new URLSearchParams({
    query,
    tags: `comment,story_${thread.objectID}`,
    hitsPerPage: '50',
  })

  const commentRes = await fetch(`https://hn.algolia.com/api/v1/search?${commentParams}`, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(15_000),
  })

  if (!commentRes.ok) return `Error searching comments: HTTP ${commentRes.status}`

  const commentData = await commentRes.json() as { hits: HNHit[] }
  const comments = commentData.hits.map(c => ({
    id: c.objectID,
    author: c.author,
    date: c.created_at,
    url: `https://news.ycombinator.com/item?id=${c.objectID}`,
    source: `HN Who is Hiring (${month})`,
    text: stripHtml(c.comment_text || '').slice(0, 1000),
  }))

  return truncate(JSON.stringify({
    thread_title: thread.title,
    thread_url: `https://news.ycombinator.com/item?id=${thread.objectID}`,
    results: comments.length,
    jobs: comments,
  }, null, 2))
}

/** Convert "2026-03" to "March 2026" for HN thread title matching. */
function formatMonth(ym: string): string {
  const [y, m] = ym.split('-')
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  return `${months[parseInt(m, 10) - 1]} ${y}`
}

/** Strip HTML tags from a string. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// --- JSearch (RapidAPI) ---

interface JSearchJob {
  job_id: string
  job_title: string
  employer_name: string
  employer_logo: string
  job_description: string
  job_city: string
  job_state: string
  job_country: string
  job_is_remote: boolean
  job_apply_link: string
  job_posted_at_datetime_utc: string
  job_min_salary: number | null
  job_max_salary: number | null
  job_salary_currency: string
  job_salary_period: string
  job_required_skills: string[] | null
  job_highlights: {
    Qualifications?: string[]
    Responsibilities?: string[]
    Benefits?: string[]
  }
}

async function searchJSearch(args: Record<string, string>): Promise<string> {
  const apiKey = process.env.JSEARCH_API_KEY
  if (!apiKey) return 'Error: JSEARCH_API_KEY not configured. Get a free key at https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch — 200 free requests/month.'

  const params = new URLSearchParams({
    query: args.query,
    remote_jobs_only: args.remote_jobs_only !== 'false' ? 'true' : 'false',
    num_pages: String(Number(args.num_pages) || 1),
  })
  if (args.date_posted) params.set('date_posted', args.date_posted)

  const res = await fetch(`https://jsearch.p.rapidapi.com/search?${params}`, {
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) return `Error: HTTP ${res.status} ${res.statusText}`

  const data = await res.json() as { data: JSearchJob[] }
  const jobs = (data.data || []).map(j => ({
    title: j.job_title,
    company: j.employer_name,
    location: j.job_is_remote ? 'Remote' : [j.job_city, j.job_state, j.job_country].filter(Boolean).join(', '),
    is_remote: j.job_is_remote,
    url: j.job_apply_link,
    source: 'JSearch (LinkedIn/Indeed/Glassdoor)',
    salary_min: j.job_min_salary,
    salary_max: j.job_max_salary,
    salary_currency: j.job_salary_currency || null,
    salary_period: j.job_salary_period || null,
    required_skills: j.job_required_skills,
    posted: j.job_posted_at_datetime_utc,
    description_preview: (j.job_description || '').slice(0, 800),
    qualifications: j.job_highlights?.Qualifications?.slice(0, 5) || [],
    responsibilities: j.job_highlights?.Responsibilities?.slice(0, 5) || [],
  }))

  return truncate(JSON.stringify(jobs, null, 2))
}

// --- Adzuna ---

interface AdzunaJob {
  id: string
  title: string
  description: string
  redirect_url: string
  created: string
  company: { display_name: string }
  location: { display_name: string; area: string[] }
  salary_min: number
  salary_max: number
  category: { label: string; tag: string }
  contract_type: string
  contract_time: string
}

async function searchAdzuna(args: Record<string, string>): Promise<string> {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY
  if (!appId || !appKey) return 'Error: ADZUNA_APP_ID and ADZUNA_APP_KEY not configured. Register free at https://developer.adzuna.com/'

  const country = args.country || 'us'
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: String(Math.min(Number(args.results_per_page) || 20, 50)),
    what: args.what,
  })
  if (args.where) params.set('where', args.where)
  if (args.salary_min) params.set('salary_min', args.salary_min)

  const res = await fetch(`https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`, {
    headers: { ...FETCH_HEADERS, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) return `Error: HTTP ${res.status} ${res.statusText}`

  const data = await res.json() as { results: AdzunaJob[] }
  const jobs = (data.results || []).map(j => ({
    title: j.title,
    company: j.company?.display_name,
    location: j.location?.display_name,
    area: j.location?.area,
    url: j.redirect_url,
    source: 'Adzuna',
    category: j.category?.label,
    salary_min: j.salary_min || null,
    salary_max: j.salary_max || null,
    contract_type: j.contract_type || null,
    contract_time: j.contract_time || null,
    posted: j.created,
    description_preview: (j.description || '').slice(0, 500),
  }))

  return truncate(JSON.stringify(jobs, null, 2))
}

// --- Jooble ---

interface JoobleJob {
  title: string
  location: string
  snippet: string
  salary: string
  source: string
  type: string
  link: string
  company: string
  updated: string
  id: string
}

async function searchJooble(args: Record<string, string>): Promise<string> {
  const apiKey = process.env.JOOBLE_API_KEY
  if (!apiKey) return 'Error: JOOBLE_API_KEY not configured. Register free at https://jooble.org/api/about'

  const body = {
    keywords: args.keywords,
    location: args.location || '',
    ...(args.salary ? { salary: Number(args.salary) } : {}),
    page: Number(args.page) || 1,
  }

  const res = await fetch(`https://jooble.org/api/${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) return `Error: HTTP ${res.status} ${res.statusText}`

  const data = await res.json() as { jobs: JoobleJob[] }
  const jobs = (data.jobs || []).map(j => ({
    title: j.title,
    company: j.company,
    location: j.location,
    url: j.link,
    source: `Jooble (via ${j.source || 'aggregator'})`,
    type: j.type || null,
    salary: j.salary || null,
    updated: j.updated,
    description_preview: stripHtml(j.snippet || '').slice(0, 500),
  }))

  return truncate(JSON.stringify(jobs, null, 2))
}

// --- Handler ---

export function createHandler(): (name: string, args: Record<string, string>) => Promise<string | null> {
  return async (name, args) => {
    try {
      switch (name) {
        case 'search_remotive': return await searchRemotive(args)
        case 'search_remoteok': return await searchRemoteOK(args)
        case 'search_jobicy': return await searchJobicy(args)
        case 'search_hn_hiring': return await searchHNHiring(args)
        case 'search_jsearch': return await searchJSearch(args)
        case 'search_adzuna': return await searchAdzuna(args)
        case 'search_jooble': return await searchJooble(args)
        default: return null
      }
    } catch (e: any) {
      return `Error: ${e.message}`
    }
  }
}
