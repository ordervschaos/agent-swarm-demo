---
name: pipeline-digest
description: Generate a weekly digest of the job pipeline status
---
Generate a pipeline status digest. Use today's actual date.

## Steps

1. **Read pipeline**: Load `sandbox/pipeline.json`. If it doesn't exist, report that the pipeline is empty.

2. **Count by status**: Tally jobs in each status (discovered, interested, applied, interviewing, offered, rejected, passed).

3. **Highlight stale items**: Flag any jobs where `date_updated` is more than 7 days ago — these need attention.

4. **Recent activity**: List jobs added or updated in the last 7 days.

5. **Write summary**: Save the digest to `sandbox/digest-YYYY-MM-DD.md` (using today's date) with:
   - Status breakdown (counts)
   - Stale items needing follow-up
   - Recent additions
   - Recommended next actions (e.g., "Follow up on 3 applications with no update")
