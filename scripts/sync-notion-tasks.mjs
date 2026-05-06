import { readFileSync } from 'fs'

const NOTION_KEY = process.env.NOTION_KEY
const PARENT_PAGE_ID = '34e2c920165f80db997cf686438d4153'
const TASKS_FILE = '/Users/nishi/Documents/Personal/Passion Projects/Vairis/docs/superpowers/plans/2026-04-23-vairis-ecommerce.md.tasks.json'

const headers = {
  'Authorization': `Bearer ${NOTION_KEY}`,
  'Content-Type': 'application/json',
  'Notion-Version': '2022-06-28',
}

async function notionPost(endpoint, body) {
  const res = await fetch(`https://api.notion.com/v1/${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Notion API error on ${endpoint}: ${JSON.stringify(data)}`)
  return data
}

function extract(description, field) {
  const m = description.match(new RegExp(`\\*\\*${field}:\\*\\*\\s*(.+?)(?:\\n|$)`))
  return m ? m[1].replace(/`/g, '').trim() : ''
}

function richText(str) {
  if (!str) return []
  const chunks = []
  for (let i = 0; i < str.length; i += 2000) {
    chunks.push({ text: { content: str.slice(i, i + 2000) } })
  }
  return chunks
}

async function main() {
  const { tasks } = JSON.parse(readFileSync(TASKS_FILE, 'utf8'))

  // Create the task database directly inside the provided page
  const db = await notionPost('databases', {
    parent: { type: 'page_id', page_id: PARENT_PAGE_ID },
    icon: { type: 'emoji', emoji: '💎' },
    title: [{ type: 'text', text: { content: 'Vairis E-commerce — Task Board' } }],
    properties: {
      'Name':       { title: {} },
      'Status':     { select: { options: [
        { name: 'pending',     color: 'gray'   },
        { name: 'in_progress', color: 'yellow' },
        { name: 'completed',   color: 'green'  },
      ]}},
      'Task ID':    { number: { format: 'number' } },
      'Blocked By': { rich_text: {} },
      'Goal':       { rich_text: {} },
      'Verify':     { rich_text: {} },
    },
  })
  console.log(`✓ Database created: ${db.url}`)

  // Create one page (row) per task
  for (const task of tasks) {
    const goal       = extract(task.description, 'Goal')
    const verify     = extract(task.description, 'Verify')
    const blockedStr = task.blockedBy?.join(', ') ?? ''

    const bodyText = task.description.replace(/```json:metadata[\s\S]*?```/g, '').trim()

    await notionPost('pages', {
      parent: { database_id: db.id },
      properties: {
        'Name':       { title:     [{ text: { content: task.subject } }] },
        'Status':     { select:    { name: task.status } },
        'Task ID':    { number:    task.id },
        'Blocked By': { rich_text: richText(blockedStr) },
        'Goal':       { rich_text: richText(goal)       },
        'Verify':     { rich_text: richText(verify)     },
      },
      children: [{
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: richText(bodyText.slice(0, 2000)) },
      }],
    })
    console.log(`  ✓ ${task.subject}`)
  }

  console.log(`\nDone — ${tasks.length} tasks synced to Notion.`)
  console.log(`Open: ${db.url}`)
}

main().catch(err => { console.error(err.message); process.exit(1) })
