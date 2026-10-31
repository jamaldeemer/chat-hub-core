// After the hub writes its notes (Edit/Write, or a shell command naming hub-notes.md):
// if they've turned into a diary or grown too big, tell it to rewrite them as one snapshot.
import { realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { hookInput, hubNotesFile, notesProblem, readConfig, readHub, say } from './config.mjs'

const input = hookInput()
const cwd = input.cwd || process.cwd()
const c = readConfig(cwd)
if (!c) process.exit(0)
const hub = readHub(c)
if (!(hub.session && input.session_id === hub.session)) process.exit(0)
const notes = hubNotesFile()
if (!notes) process.exit(0)
const ti = input.tool_input || {}
const real = p => { try { return realpathSync(p) } catch { return p } }
const file = ti.file_path ? real(resolve(cwd, String(ti.file_path).replace(/^~(?=\/|$)/, homedir()))) : ''
const touched = file ? file === real(notes) : String(ti.command || '').includes('hub-notes.md')
if (!touched) process.exit(0)
const problem = notesProblem(c, notes)
if (problem) say('PostToolUse', problem)
