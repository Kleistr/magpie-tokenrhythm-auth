// The session token (tr_session) a TokenRhythm account keeps beside its API
// key, and how to change just that: magpie's auth file is the single source
// of truth (logout clears it, the plugin reads it), so this updates that
// account's metadata in place, under magpie's own lock.
//
// Pure parts are exported for tests; the command line is at the bottom.

import { closeSync, existsSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { homedir } from "node:os"
import { execFileSync } from "node:child_process"

export const PROVIDER = "tokenrhythm"
export const WALLET_URL = "https://tokenrhythm.studio/api/wallet/summary"

/** magpie's config folder: $XDG_CONFIG_HOME/magpie, else ~/.config/magpie. */
export function authPath(env = process.env) {
  const home = env.HOME || env.USERPROFILE || homedir()
  const base = env.XDG_CONFIG_HOME || join(home, ".config")
  return join(base, "magpie", "plugin-auth.json")
}

/** Every account of the provider in an auth file, in file order. */
export function accountsOf(auth) {
  return Object.entries(auth ?? {})
    .filter(([key]) => key === PROVIDER || key.startsWith(PROVIDER + "#"))
    .map(([key, entry]) => ({ key, entry }))
}

/** The account an --account names: its key, its tail, or its 1-based number. */
export function pickAccount(accounts, wanted) {
  const w = String(wanted ?? "").trim()
  if (!w) {
    if (accounts.length === 1) return accounts[0]
    if (accounts.length === 0) return { error: `magpie 里没有 ${PROVIDER} 账号：先 magpie plugin login ${PROVIDER}` }
    return {
      error:
        "有多个 TokenRhythm 账号，用 --account 指定一个：\n" +
        accounts.map((a, i) => `  ${i + 1}. ${a.key}  ${maskKey(a.entry?.key)}`).join("\n"),
    }
  }
  const byNumber = /^\d+$/.test(w) ? accounts[Number(w) - 1] : undefined
  const found =
    byNumber ||
    accounts.find((a) => a.key === w) ||
    accounts.find((a) => String(a.entry?.key ?? "").endsWith(w.replace(/^…/, ""))) ||
    accounts.find((a) => a.key.endsWith(w))
  return found ?? { error: `没有这个 ${PROVIDER} 账号：${w}（--account 可用编号或 key 末尾）` }
}

/** auth with one account's session set (or cleared, with null). Never mutates. */
export function withSession(auth, key, session) {
  if (!auth?.[key]) return { error: `没有这个 ${PROVIDER} 账号：${key}` }
  const entry = { ...auth[key] }
  const metadata = { ...(entry.metadata ?? {}) }
  if (session === null) delete metadata.session
  else metadata.session = session
  if (Object.keys(metadata).length > 0) entry.metadata = metadata
  else delete entry.metadata
  return { ...auth, [key]: entry }
}

export function maskSession(session) {
  const s = String(session ?? "")
  return s.length <= 9 ? "sess_…" : `sess_…${s.slice(-4)}`
}

function maskKey(key) {
  const k = String(key ?? "")
  return k.length <= 4 ? "" : `…${k.slice(-4)}`
}

/** What the browser copied last, "" where there is no clipboard to read. */
export function readClipboard() {
  try {
    const cmd =
      process.platform === "darwin"
        ? ["pbpaste", []]
        : process.platform === "win32"
          ? ["powershell", ["-NoProfile", "-Command", "Get-Clipboard"]]
          : ["sh", ["-c", "command -v wl-paste >/dev/null && wl-paste -n || xclip -selection clipboard -o 2>/dev/null"]]
    return String(execFileSync(cmd[0], cmd[1], { timeout: 1500, encoding: "utf8" })).trim()
  } catch {
    return ""
  }
}

/** Whether the vendor still accepts the session (the wallet answers). */
export async function sessionWorks(session, http = fetch) {
  try {
    const res = await http(WALLET_URL, { headers: { accept: "*/*", cookie: `tr_session=${session}` } })
    const wallet = await res.json()
    return wallet?.code === 0 ? { ok: true } : { ok: false, error: wallet?.message ?? `HTTP ${res.status}` }
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e) }
  }
}

/** magpie's lock: plugin-auth.json.lock, held at most 10s, then stale. */
function lockAuth(path) {
  const lock = path + ".lock"
  const start = Date.now()
  for (;;) {
    try {
      closeSync(openSync(lock, "wx", 0o600))
      return () => rmSync(lock, { force: true })
    } catch {
      if (Date.now() - start > 10_000) throw new Error(`${lock} 一直没放开：等一会儿再试`)
      try {
        if (Date.now() - statSync(lock).mtimeMs > 10_000) rmSync(lock, { force: true })
      } catch {}
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50)
    }
  }
}

/** Replace the file in one step, as magpie does: no half-written auth. */
function writeAtomic(path, text) {
  const tmp = join(dirname(path), `.plugin-auth.${process.pid}.tmp`)
  writeFileSync(tmp, text, { mode: 0o600 })
  renameSync(tmp, path)
}

function parseArgs(argv) {
  const out = { account: "", session: "", clear: false, verify: true, file: "" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--account" || a === "-a") out.account = argv[++i] ?? ""
    else if (a === "--session" || a === "-s") out.session = argv[++i] ?? ""
    else if (a === "--file") out.file = argv[++i] ?? ""
    else if (a === "--clear") out.clear = true
    else if (a === "--no-verify") out.verify = false
    else if (a === "--help" || a === "-h") out.help = true
    else if (!a.startsWith("-") && !out.session) out.session = a
    else throw new Error(`不认识的参数：${a}`)
  }
  return out
}

const HELP = `用法：node scripts/set-session.mjs [--account <编号|key末尾>] [sess_…] [--clear]

只更新 TokenRhythm 账号的会话令牌（tr_session），不用重新输入 API key。

  （不写令牌）   从剪贴板读：先在浏览器复制 tr_session，再直接运行
  sess_…         直接给令牌
  --clear        清除会话令牌，余额卡片不再显示
  --account      有多个 TokenRhythm 账号时选一个（编号或 key 末尾）
  --file         用另一个 plugin-auth.json（默认按 XDG_CONFIG_HOME）

取令牌：tokenrhythm.studio/account → 开发者工具 → 应用 → Cookie → tr_session
`

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(HELP)
    return 0
  }
  const path = args.file || authPath()
  if (!existsSync(path)) {
    console.error(`找不到 ${path}：先 magpie plugin login ${PROVIDER}`)
    return 1
  }
  const auth = JSON.parse(readFileSync(path, "utf8"))
  const picked = pickAccount(accountsOf(auth), args.account)
  if (picked.error) {
    console.error(picked.error)
    return 1
  }

  let session = null
  if (!args.clear) {
    session = (args.session || readClipboard()).trim()
    if (!/^sess_\S+$/.test(session)) {
      console.error("没有拿到会话令牌：复制 tr_session 后再运行，或把 sess_… 作为参数传入")
      return 1
    }
    if (args.verify) {
      const check = await sessionWorks(session)
      if (!check.ok) {
        console.error(`这个会话令牌不能用：${check.error}\n到 tokenrhythm.studio/account 重新登录后复制新的 tr_session`)
        return 1
      }
    }
  }

  const unlock = lockAuth(path)
  try {
    const fresh = JSON.parse(readFileSync(path, "utf8"))
    const out = withSession(fresh, picked.key, session)
    if (out.error) {
      console.error(out.error)
      return 1
    }
    writeAtomic(path, JSON.stringify(out, null, 2) + "\n")
  } finally {
    unlock()
  }

  if (session) console.log(`✓ ${picked.key} 的会话令牌已更新为 ${maskSession(session)}`)
  else console.log(`✓ ${picked.key} 的会话令牌已清除：余额卡片不再显示`)
  console.log("  magpie quota 看余额，magpie plugin 看账号状态")
  return 0
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => process.exit(code))
}
