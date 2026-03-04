---
name: job-search
description: Autonomous job search — find remote full-stack, backend, and AI/ML roles
---
Run a comprehensive job search for remote software roles. Use today's actual date for file names and records.

## Steps

1. **Check previous discoveries**: Read files in your sandbox to see what you've already found. Avoid duplicates.

2. **Search multiple sources** using web_search (run at least 3-4 different searches):
   - "senior remote full-stack engineer jobs global 2026"
   - "senior staff remote AI ML engineer jobs hiring now"
   - "Hacker News who is hiring March 2026"
   - "RemoteOK senior software engineer"
   - "senior remote backend engineer India global"

3. **Fetch promising results**: Use fetch_page on the most relevant search results to get job details. If a page returns an error, skip it and try the next one.

4. **Structure results**: Save new discoveries to `sandbox/discoveries-YYYY-MM-DD.json` (using today's date) as a JSON array. Each entry needs: title, company, location, url, source, date_found, summary, tags.

5. **Notify Tracker**: Send a message to **tracker** containing the **full JSON array** of all discovered jobs. Tracker cannot access your sandbox, so include the complete data in the message. Format: "New discoveries: [full JSON array]"

Keep results focused — skip vague listings, agencies, or roles that don't match the target criteria. You must search at least 3 sources before concluding.
