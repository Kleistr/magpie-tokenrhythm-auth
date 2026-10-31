// magpie-tokenrhythm-auth
// magpie (and OpenCode) provider plugin for TokenRhythm (https://tokenrhythm.studio).
//
// What it does:
// - API-key sign in (Authorization: Bearer sk_tr_…)
// - Lists the account's chat models from GET /v1/models at runtime,
//   with a snapshot from October 2026 as fallback when the query fails.
// - Declares the provider as a System One decision API (`decide: true`), so
//   magpie asks NeoHorse-Jev-4B at {BASE}/systemone for a routing group's
//   classifier, and adapts magpie's requests: TokenRhythm rejects choice
//   criteria with null descriptions (422), so nulls become the option name.
//   The model stays listed too, so it is visible and pickable as a
//   classifier without magpie's `provider models … +<model>` dance.
//
// Everything testable lives on the `_internal` export.

import { execFileSync } from "node:child_process"

const PROVIDER = "tokenrhythm"
const BASE = "https://tokenrhythm.studio/v1"
const VERSION = "0.0.1"

/** TokenRhythm prices are in CNY; magpie's model costs are USD per million tokens. */
export const CNY_PER_USD = 7.2

/** TokenRhythm's decision (System One) model. It is not listed by /v1/models. */
export const DECIDE_MODELS = ["NeoHorse-Jev-4B"]

export const FALLBACK_PROVIDER_CONFIG = {
  name: "TokenRhythm",
  npm: "@ai-sdk/openai-compatible", // chat completions at {BASE}/chat/completions
  api: BASE,
  // TokenRhythm serves magpie's System One classifier at {BASE}/systemone.
  decide: true,
  models: {
    "glm-5.1": { name: "glm-5.1", limit: { context: 200000, output: 128000 }, tool_call: true, reasoning: true, modalities: { input: ["text"] }, cost: { input: 1.1111, output: 3.8889, cache_read: 0.2778 } },
    "minimax-m2.7": { name: "minimax-m2.7", limit: { context: 200000, output: 192000 }, tool_call: true, reasoning: true, modalities: { input: ["text"] }, cost: { input: 0.2917, output: 1.1667 } },
    "kimi-k2.6": { name: "kimi-k2.6", limit: { context: 256000, output: 128000 }, tool_call: true, reasoning: true, modalities: { input: ["text", "image"] }, cost: { input: 0.9028, output: 3.75, cache_read: 0.1806 } },
    "qwen3.7-max": { name: "qwen3.7-max", limit: { context: 1000000, output: 131072 }, tool_call: true, reasoning: true, modalities: { input: ["text"] }, cost: { input: 0.8333, output: 2.5, cache_read: 0.1667 } },
    "kimi-k2.7-code": { name: "kimi-k2.7-code", limit: { context: 256000, output: 16000 }, tool_call: true, reasoning: true, modalities: { input: ["text", "image"] }, cost: { input: 0.9028, output: 3.75, cache_read: 0.1806 } },
    "glm-5.2": { name: "glm-5.2", limit: { context: 1000000, output: 128000 }, tool_call: true, reasoning: true, modalities: { input: ["text"] }, cost: { input: 1.1111, output: 3.8889, cache_read: 0.2778 } },
    "qwen3.8-max": { name: "qwen3.8-max", limit: { context: 1000000, output: 131072 }, tool_call: true, reasoning: true, modalities: { input: ["text", "image"] }, cost: { input: 0.8333, output: 2.5, cache_read: 0.1042 } },
    "deepseek-v4-flash-0731": { name: "deepseek-v4-flash-0731", limit: { context: 1000000, output: 384000 }, tool_call: true, reasoning: true, modalities: { input: ["text"] }, cost: { input: 0.2083, output: 0.625, cache_read: 0.0208 } },
    "seed-2.1-turbo": { name: "seed-2.1-turbo", limit: { context: 262144, output: 131072 }, tool_call: true, reasoning: true, modalities: { input: ["text", "image"] }, cost: { input: 0.4167, output: 2.0833, cache_read: 0.0833 } },
    "seed-2.1-pro": { name: "seed-2.1-pro", limit: { context: 262144, output: 131072 }, tool_call: true, reasoning: true, modalities: { input: ["text", "image"] }, cost: { input: 0.8333, output: 4.1667, cache_read: 0.1667 } },
    "deepseek-v4-pro-0813": { name: "deepseek-v4-pro-0813", limit: { context: 1000000, output: 384000 }, tool_call: true, reasoning: true, modalities: { input: ["text"] }, cost: { input: 0.625, output: 1.875, cache_read: 0.0208 } },
    "glm-5.3": { name: "glm-5.3", limit: { context: 1048576, output: 131072 }, tool_call: true, reasoning: true, modalities: { input: ["text"] }, cost: { input: 1.1111, output: 3.8889, cache_read: 0.2778 } },
    "qwen3.7-flash": { name: "qwen3.7-flash", limit: { context: 1000000, output: 131072 }, tool_call: true, reasoning: true, modalities: { input: ["text", "image"] }, cost: { input: 0.0833, output: 0.3333, cache_read: 0.0167 } },
    "qwen3.8-27b": { name: "qwen3.8-27b", limit: { context: 1000000, output: 131072 }, tool_call: true, reasoning: true, modalities: { input: ["text", "image"] }, cost: { input: 0.2083, output: 0.8333, cache_read: 0.0417 } },
    "kimi-k3": { name: "kimi-k3", limit: { context: 1048576, output: 1048576 }, tool_call: true, reasoning: true, modalities: { input: ["text", "image"] }, cost: { input: 2.7778, output: 13.8889, cache_read: 0.2778 } },
    "longcat-2.0": { name: "longcat-2.0", limit: { context: 1000000, output: 128000 }, tool_call: true, reasoning: true, modalities: { input: ["text"] }, cost: { input: 0.6944, output: 2.7778, cache_read: 0.0139 } },
    "glm-5.3-flash": { name: "glm-5.3-flash", limit: { context: 1048576, output: 131072 }, tool_call: true, reasoning: true, modalities: { input: ["text", "image"] }, cost: { input: 0.1111, output: 0.3889, cache_read: 0.0319 } },
    "qwen3.8-flash": { name: "qwen3.8-flash", limit: { context: 1000000, output: 131072 }, tool_call: true, reasoning: true, modalities: { input: ["text", "image"] }, cost: { input: 0.0556, output: 0.1875, cache_read: 0.0069 } },
    "deepseek-flash": { name: "deepseek-flash", limit: { context: 1000000, output: 384000 }, tool_call: true, reasoning: true, modalities: { input: ["text", "image"] }, cost: { input: 0.1389, output: 0.5556, cache_read: 0.0028 } },
    "neohorse-1-9b": { name: "neohorse-1-9b", limit: { context: 262144, output: 32768 }, tool_call: true, reasoning: true, modalities: { input: ["text"] }, cost: { input: 0.0, output: 0.0 } },
    "glm-5.3-flashx": { name: "glm-5.3-flashx", limit: { context: 1048576, output: 131072 }, tool_call: true, reasoning: true, modalities: { input: ["text", "image"] }, cost: { input: 0.2778, output: 0.9722, cache_read: 0.0792 } },
    "mimo-v2.6-pro": { name: "mimo-v2.6-pro", limit: { context: 1048576, output: 131072 }, tool_call: true, reasoning: true, modalities: { input: ["text", "image"] }, cost: { input: 0.4167, output: 0.8333, cache_read: 0.0035 } },
    "mimo-v2.6-flash": { name: "mimo-v2.6-flash", limit: { context: 1048576, output: 131072 }, tool_call: true, reasoning: true, modalities: { input: ["text", "image"] }, cost: { input: 0.1389, output: 0.2778, cache_read: 0.0028 } },
    "deepseek-v4.1-flash-1017": { name: "deepseek-v4.1-flash-1017", limit: { context: 1000000, output: 384000 }, tool_call: true, reasoning: true, modalities: { input: ["text", "image"] }, cost: { input: 0.1389, output: 0.5556, cache_read: 0.0028 } },
    "minimax-m3.1-flash": { name: "minimax-m3.1-flash", limit: { context: 1000000, output: 524288 }, tool_call: true, reasoning: true, modalities: { input: ["text", "image"] }, cost: { input: 0.1389, output: 0.5556, cache_read: 0.0139 } },
    "NeoHorse-Jev-4B": {
      name: "NeoHorse Jev 4B (决策模型)",
      limit: { context: 262144, output: 32768 },
      tool_call: false,
      reasoning: false,
      modalities: { input: ["text"] },
      // Not a conversation model: magpie hides these from agents' lists but
      // its routing groups may still name one as their classifier.
      decides: true,
    },
  },
}

type Price = string | number | null | undefined

/** CNY per million tokens → USD per million tokens (fixed, documented rate). */
export function cnyToUsd(cny: number): number {
  return cny / CNY_PER_USD
}

function priceValue(
  src: Record<string, any>,
  effectiveKey: string,
  listedKey: string,
): number | undefined {
  const raw: Price = src[effectiveKey] ?? src[listedKey]
  if (raw == null || raw === "") return undefined
  const n = typeof raw === "string" ? Number.parseFloat(src[effectiveKey] ?? src[listedKey]) : raw
  return Number.isFinite(n) && n !== 0 ? cnyToUsd(n) : n === 0 ? 0 : undefined
}

/**
 * Turn TokenRhythm's GET /v1/models response into OpenCode provider models.
 * decideModels are prepended even though the api never lists them.
 */
export function mapModels(data: { data?: any[] }, opts: { decideModels?: string[] } = {}) {
  const out: Record<string, any> = {}
  for (const m of data?.data ?? []) {
    if (!m?.id || m.id.includes("embedding")) continue
    const cost: Record<string, number> = {}
    const input = priceValue(m, "effective_input_price_per_million", "input_price_per_million")
    const output = priceValue(m, "effective_output_price_per_million", "output_price_per_million")
    const cache = priceValue(m, "effective_cache_read_price_per_million", "cache_read_price_per_million")
    if (input !== undefined) cost.input = input
    if (output !== undefined) cost.output = output
    if (cache !== undefined) cost.cache_read = cache
    out[m.id] = {
      id: m.id,
      name: m.name ?? m.id,
      limit: {
        context: m.context_length || undefined,
        output: m.max_completion_tokens || undefined,
      },
      tool_call: m.supports_tools !== false,
      reasoning: m.supports_reasoning === true,
      modalities: { input: m.supports_vision === true ? ["text", "image"] : ["text"] },
      cost,
    }
  }
  for (const id of opts.decideModels ?? []) {
    if (!out[id]) {
      out[id] = {
        id,
        name: id,
        // A System One model answers at {BASE}/systemone, not an AI SDK
        // protocol: no npm, so magpie never sends it a chat request (that
        // would come back as "当前模型不支持该协议：openai").
        limit: { context: 262144, output: 32768 },
        tool_call: false,
        reasoning: false,
        modalities: { input: ["text"] },
        decides: true,
      }
    }
  }
  return out
}

const isSystemOne = (input: string | URL | Request) => String(input).includes("/systemone")

/**
 * magpie's System One body passes through as-is except for one rule:
 * TokenRhythm rejects choice criteria whose description is null or ""
 * (HTTP 422, JEV_INVALID_REQUEST). Fill those with the option name.
 */
export function adaptSystemOneBody(body: string): string {
  let parsed: any
  try {
    parsed = JSON.parse(body)
  } catch {
    return body
  }
  const questions = parsed?.questions
  if (questions && typeof questions === "object") {
    for (const q of Object.values(questions) as any[]) {
      const criteria = q?.criteria
      if (criteria && !Array.isArray(criteria) && typeof criteria === "object") {
        for (const key of Object.keys(criteria)) {
          if (criteria[key] == null || criteria[key] === "") criteria[key] = key
        }
      }
    }
  }
  return JSON.stringify(parsed)
}

/**
 * The per-account fetch TokenRhythm wants: bearer auth everywhere,
 * and the criteria fixup on System One requests only.
 */
export function authedFetch(key: string, inner: typeof fetch = fetch): typeof fetch {
  return async function (input: any, init?: any) {
    const headers = new Headers(init?.headers)
    headers.set("authorization", `Bearer ${key}`)
    headers.set("x-tokenrhythm-client", `magpie-tokenrhythm-auth/${VERSION}`)
    let next = { ...init, headers }
    if (isSystemOne(input) && typeof init?.body === "string") {
      console.log("[tokenrhythm] POSTing a System One decision to", String(input))
      next = { ...next, body: adaptSystemOneBody(init.body) }
    }
    return inner(input, next)
  }
}

/**
 * TokenRhythm's wallet summary (GET /api/wallet/summary, a web-session
 * endpoint) as magpie's usage: a prepaid balance the account spends, not
 * a window that resets — hence aside, with the gift/recharge split shown.
 */
export function mapUsage(wallet: any) {
  const d = wallet?.data
  if (wallet?.code !== 0 || !d) {
    return { error: `TokenRhythm: ${wallet?.message ?? "无法读取钱包"}（会话令牌可能已过期）`, windows: [] }
  }
  const cny = (v: any) => Number.parseFloat(v ?? "0")
  const total = cny(d.availableBalanceCny)
  const gift = cny(d.giftAvailableCny)
  const recharge = cny(d.rechargeBalanceCny)
  return {
    balance: `¥${total.toFixed(2)}`,
    windows: [
      {
        name: "余额",
        balance: total,
        unit: "CNY",
        display: `赠送 ¥${gift.toFixed(2)} · 充值 ¥${recharge.toFixed(2)}`,
      },
    ],
  }
}

/**
 * The plugin's own picture, kept in the plugin folder (assets/icon.png),
 * as magpie takes one: magpie accepts only an https URL or a data:image
 * URI for an icon, never a path, so the file is inlined (7 KB here, the
 * limit is 4 MB). "" when it cannot be read, which magpie reads as "no icon".
 */
export async function localIcon(rel = "./assets/icon.png"): Promise<string> {
  try {
    const { readFile } = await import("node:fs/promises")
    const file = new URL(rel, import.meta.url)
    const bytes = await readFile(file)
    const ext = file.pathname.split(".").pop()?.toLowerCase()
    const type = ext === "svg" ? "image/svg+xml" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png"
    return `data:${type};base64,${bytes.toString("base64")}`
  } catch {
    return ""
  }
}

/**
 * What sign-in asks before the key: whether the balance is wanted at all,
 * then the web session that alone can read it. Answering "不显示" keeps the
 * account free of a cookie that expires; answering "显示" stores it and
 * magpie shows the balance until the session ends.
 */
export function loginPrompts() {
  return [
    {
      type: "select",
      key: "balance",
      message: "显示余额（需要网页会话令牌）",
      options: [
        { label: "显示", value: "on", hint: "从浏览器取 tr_session" },
        { label: "不显示", value: "off", hint: "只用 API key，余额未知" },
      ],
    },
    {
      type: "password",
      key: "session",
      message: "会话令牌 tr_session（在浏览器复制后直接回车 = 用剪贴板）",
      placeholder: "sess_…（tokenrhythm.studio 的 tr_session cookie）",
      when: { key: "balance", op: "eq", value: "on" },
      validate: (v: string) => (v === "" || /^sess_\S+$/.test(v.trim()) ? undefined : "以 sess_ 开头"),
    },
  ]
}

/** What the browser copied last, "" where there is no clipboard to read. */
export function readClipboard(): string {
  try {
    const cmd =
      process.platform === "darwin"
        ? ["pbpaste", []]
        : process.platform === "win32"
          ? ["powershell", ["-NoProfile", "-Command", "Get-Clipboard"]]
          : ["sh", ["-c", "command -v wl-paste >/dev/null && wl-paste -n || xclip -selection clipboard -o 2>/dev/null"]]
    return String(execFileSync(cmd[0] as string, cmd[1] as string[], { timeout: 1500, encoding: "utf8" }))
  } catch {
    return ""
  }
}

/** The wallet summary's URL: a web-session endpoint, not part of /v1. */
export const WALLET_URL = "https://tokenrhythm.studio/api/wallet/summary"

/**
 * magpie calls this before it stores a sign-in (auth.methods[].authorize):
 * a key the vendor refuses, or a session that can no longer read the
 * wallet, fails here with why instead of being kept to fail quietly.
 */
export async function authorizeLogin(
  inputs: any,
  http: typeof fetch = fetch,
  clipboard: () => string = readClipboard,
): Promise<any> {
  // magpie hands this the prompts' answers only; the API key is its own
  // to store (host.js apiKey → save), so there is none to check here.
  let session = String(inputs?.session ?? "").trim()
  if (inputs?.balance === "off") return { type: "success" }
  // Nothing typed: take what the browser just copied (the prompt says so).
  if (!session) {
    const pasted = clipboard().trim()
    if (!/^sess_\S+$/.test(pasted)) {
      return {
        type: "failed",
        error: "剪贴板里没有 tr_session：到 tokenrhythm.studio/account 复制会话令牌后再试，或上一步选「不显示」",
      }
    }
    session = pasted
  }

  try {
    const res = await http(WALLET_URL, { headers: { accept: "*/*", cookie: `tr_session=${session}` } })
    const wallet = await res.json()
    if (wallet?.code !== 0) {
      return {
        type: "failed",
        error: "会话令牌无效或已过期：到 tokenrhythm.studio/account 重新登录后取新的 tr_session，或上一步选「不显示」",
      }
    }
  } catch {
    return { type: "failed", error: "读取钱包失败，检查网络或代理后再试" }
  }
  return { type: "success", metadata: { session } }
}

export const TokenRhythmAuthPlugin = async () => ({
  async config(cfg: any) {
    cfg.provider ??= {}
    cfg.provider[PROVIDER] ??= FALLBACK_PROVIDER_CONFIG
  },

  auth: {
    provider: PROVIDER,
    maxConcurrency: 8,
    icon: await localIcon(),
    methods: [
      {
        type: "api",
        label: "TokenRhythm API key",
        placeholder: "sk_tr_…",
        // The balance lives behind the web session, not the API key:
        // https://tokenrhythm.studio/account → 网络 → tr_session cookie.
        // Re-login (magpie plugin login tokenrhythm) asks these again and,
        // the key unchanged, replaces this account's session.
        prompts: loginPrompts(),
        // Checked before the account is stored: a mistyped or expired
        // session is refused with why, not kept to fail quietly later.
        authorize: authorizeLogin,
      },
    ],
    async loader(getAuth: () => Promise<any>) {
      const auth = await getAuth()
      if (auth?.type !== "api") return {}
      return { baseURL: BASE, fetch: authedFetch(auth.key, fetch) }
    },
    // magpie's own hook (OpenCode ignores it): the wallet balance on
    // magpie quota and the provider's account card.
    async usage(getAuth: () => Promise<any>) {
      const auth = await getAuth()
      const session = auth?.metadata?.session
      if (!session) return {}
      try {
        const res = await fetch(WALLET_URL, {
          headers: { accept: "*/*", cookie: `tr_session=${session}` },
        })
        const wallet = await res.json()
        // An expired web session only costs the balance card: signIn
        // "kept" tells magpie not to mark the API key account as expired
        // (its key still answers every request).
        return { ...mapUsage(wallet), signIn: "kept" }
      } catch {
        return { error: "TokenRhythm: 钱包接口无法访问", windows: [], signIn: "kept" }
      }
    },
  },

  // The catalog changes often (models get added and taken offline);
  // ask the platform each time and keep the snapshot as fallback.
  provider: {
    id: PROVIDER,
    async models(provider: any, { auth }: { auth?: any } = {}) {
      if (auth?.type !== "api") return provider.models
      try {
        const res = await fetch(`${BASE}/models`, {
          headers: { authorization: `Bearer ${auth.key}` },
        })
        if (!res.ok) return provider.models
        const data = await res.json()
        const mapped = mapModels(data, { decideModels: DECIDE_MODELS })
        return Object.keys(mapped).length > 0 ? mapped : provider.models
      } catch {
        return provider.models
      }
    },
  },
})

export const _internal = {
  cnyToUsd,
  mapModels,
  mapUsage,
  adaptSystemOneBody,
  authedFetch,
  localIcon,
  loginPrompts,
  authorizeLogin,
  fallbackProviderConfig: () => FALLBACK_PROVIDER_CONFIG,
}
