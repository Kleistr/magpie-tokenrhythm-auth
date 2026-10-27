import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { CNY_PER_USD, _internal } from "../index.ts"

/** A trimmed sample of what GET /v1/models actually returns (Oct 2026 probe). */
const apiModels = {
  object: "list",
  data: [
    {
      id: "glm-5.1",
      object: "model",
      context_length: 200000,
      max_completion_tokens: 128000,
      currency: "CNY",
      input_price_per_million: "8.00000000",
      output_price_per_million: "28.00000000",
      cache_read_price_per_million: "2.00000000",
      effective_input_price_per_million: "4.00000000",
      effective_output_price_per_million: "14.00000000",
      effective_cache_read_price_per_million: "1.00000000",
      supports_tools: true,
      supports_reasoning: true,
      supports_vision: false,
      supports_anthropic: true,
      supports_responses: false,
    },
    {
      id: "kimi-k2.6",
      object: "model",
      context_length: 256000,
      max_completion_tokens: 128000,
      currency: "CNY",
      input_price_per_million: "6.50000000",
      output_price_per_million: "27.00000000",
      cache_read_price_per_million: null,
      has_discount: false,
      effective_input_price_per_million: "6.50000000",
      effective_output_price_per_million: "27.00000000",
      effective_cache_read_price_per_million: null,
      supports_tools: true,
      supports_reasoning: true,
      supports_vision: true,
      supports_anthropic: false,
      supports_responses: false,
    },
  ],
}

describe("mapModels", () => {
  const DECIDE = "NeoHorse-Jev-4B"
  const out = _internal.mapModels(apiModels, { decideModels: [DECIDE] } as any)

  it("keys the map by model id", () => {
    assert.ok(out["glm-5.1"])
    assert.ok(out["kimi-k2.6"])
  })

  it("maps context and output limits from the api numbers", () => {
    assert.deepEqual(out["glm-5.1"].limit, { context: 200000, output: 128000 })
    assert.deepEqual(out["kimi-k2.6"].limit, { context: 256000, output: 128000 })
  })

  it("carries tool and reasoning capabilities", () => {
    assert.equal(out["glm-5.1"].tool_call, true)
    assert.equal(out["glm-5.1"].reasoning, true)
    assert.equal(out["kimi-k2.6"].tool_call, true)
  })

  it("adds image input for vision models only", () => {
    assert.deepEqual(out["glm-5.1"].modalities, { input: ["text"] })
    assert.deepEqual(out["kimi-k2.6"].modalities, { input: ["text", "image"] })
  })

  it("converts CNY prices to USD per million tokens at the fixed rate", () => {
    assert.ok(Math.abs(out["glm-5.1"].cost.input - 4 / CNY_PER_USD) < 1e-6)
    assert.ok(Math.abs(out["glm-5.1"].cost.output - 14 / CNY_PER_USD) < 1e-6)
    assert.ok(Math.abs(out["glm-5.1"].cost.cache_read - 1 / CNY_PER_USD) < 1e-6)
  })

  it("omits cache_read when the model has none", () => {
    assert.equal(out["kimi-k2.6"].cost.cache_read, undefined)
  })

  it("names each model its id when the api gives no display name", () => {
    assert.equal(out["glm-5.1"].name, "glm-5.1")
  })

  it("lists the decision model too, but as a System One model, not a chat one", () => {
    assert.ok(out[DECIDE])
    assert.equal(out[DECIDE].decides, true)
    assert.equal(out[DECIDE].tool_call, false)
    assert.equal(out[DECIDE].reasoning, false)
  })
})

describe("adaptSystemOneBody", () => {
  // What magpie posts to {baseURL}/systemone (internal/gateway/decide.go):
  // criteria descriptions can be null, which TokenRhythm rejects with 422.
  const magpieBody = {
    model: "NeoHorse-Jev-4B",
    state: {
      message: "Fix the login page in dark mode",
      previous_message_kind: "bugfix",
    },
    questions: {
      intent: {
        type: "choice",
        instructions: "Which kind of request fits it best?",
        criteria: {
          bugfix: null,
          refactor: "Make code cleaner",
          "none-of-these": "The message is none of the other kinds",
        },
      },
      effort: {
        type: "score",
        instructions: "How much reasoning does it need?",
        criteria: ["Answer directly", "Think a bit", "Plan broadly"],
      },
    },
  }

  it("fills null choice criteria with the option name", () => {
    const out = JSON.parse(_internal.adaptSystemOneBody(JSON.stringify(magpieBody)))
    assert.equal(out.questions.intent.criteria.bugfix, "bugfix")
    assert.equal(out.questions.intent.criteria.refactor, "Make code cleaner")
    assert.equal(
      out.questions.intent.criteria["none-of-these"],
      "The message is none of the other kinds",
    )
  })

  it("leaves score criteria (an array) alone", () => {
    const out = JSON.parse(_internal.adaptSystemOneBody(JSON.stringify(magpieBody)))
    assert.deepEqual(out.questions.effort.criteria, ["Answer directly", "Think a bit", "Plan broadly"])
  })

  it("passes an object state through untouched", () => {
    const out = JSON.parse(_internal.adaptSystemOneBody(JSON.stringify(magpieBody)))
    assert.deepEqual(out.state, {
      message: "Fix the login page in dark mode",
      previous_message_kind: "bugfix",
    })
  })

  it("keeps the model field and does not invent questions", () => {
    const out = JSON.parse(_internal.adaptSystemOneBody(JSON.stringify(magpieBody)))
    assert.equal(out.model, "NeoHorse-Jev-4B")
    assert.deepEqual(Object.keys(out.questions).sort(), ["effort", "intent"])
  })
})

describe("authedFetch (the per-account fetch)", () => {
  it("adds the bearer header and only rewrites /systemone bodies", async () => {
    type Seen = { url: string; headers: Headers; body: string | undefined }
    const seen: Seen[] = []
    const fakeFetch = async (url: any, init?: any) => {
      seen.push({ url: String(url), headers: new Headers(init?.headers), body: init?.body })
      return new Response('{"ok":true}', { status: 200 })
    }
    const wrapped = _internal.authedFetch("sk_tr_test", fakeFetch as any) as any

    await wrapped("https://tokenrhythm.studio/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "glm-5.1", messages: [] }),
    })
    assert.equal(seen[0].url, "https://tokenrhythm.studio/v1/chat/completions")
    assert.equal(seen[0].headers.get("authorization"), "Bearer sk_tr_test")
    assert.deepEqual(JSON.parse(seen[0].body!), { model: "glm-5.1", messages: [] })

    await wrapped("https://tokenrhythm.studio/v1/systemone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "NeoHorse-Jev-4B",
        state: "hi",
        questions: { q: { type: "choice", criteria: { a: null } } },
      }),
      signal: AbortSignal.timeout(1000),
    })
    assert.equal(seen[1].url, "https://tokenrhythm.studio/v1/systemone")
    const rewritten = JSON.parse(seen[1].body!)
    assert.equal(rewritten.questions.q.criteria.a, "a")
  })
})

describe("fallback config", () => {
  it("declares fallback chat models, the decision model, and decide", () => {
    const cfg = _internal.fallbackProviderConfig()
    assert.ok(cfg.models["glm-5.1"])
    assert.equal(cfg.decide, true)
    assert.ok(cfg.models["NeoHorse-Jev-4B"])
  })
})

describe("what magpie is told a model speaks", () => {
  it("puts no AI SDK protocol on the decision model, so it never gets a chat request", () => {
    const out = _internal.mapModels({ data: [] }, { decideModels: ["NeoHorse-Jev-4B"] } as any)
    assert.equal(out["NeoHorse-Jev-4B"].npm, undefined)
    assert.equal(_internal.fallbackProviderConfig().models["NeoHorse-Jev-4B"].npm, undefined)
  })
})

describe("adaptSystemOneBody edges", () => {
  it("leaves a string state and noul questions untouched", () => {
    const body = {
      model: "NeoHorse-Jev-4B",
      state: "路口信号灯为红色",
      questions: { stop: { type: "noul", instructions: "停车？" } },
    }
    const out = JSON.parse(_internal.adaptSystemOneBody(JSON.stringify(body)))
    assert.deepEqual(out, body)
  })

  it("returns a body it cannot parse as it came, rather than throwing", () => {
    assert.equal(_internal.adaptSystemOneBody("{not json"), "{not json")
  })
})

describe("mapUsage (the wallet summary)", () => {
  const wallet = {
    code: 0,
    data: {
      currency: "CNY",
      availableBalanceCny: "30.15388620",
      giftAvailableCny: "20.15388620",
      rechargeBalanceCny: "10.00000000",
      asOf: "2026-10-27T10:00:48.160Z",
    },
  }

  it("shows the balance in CNY as magpie's balance field", () => {
    const u = _internal.mapUsage(wallet)
    assert.equal(u.balance, "¥30.15")
  })

  it("splits the balance into gift and recharge in its display line", () => {
    const u = _internal.mapUsage(wallet)
    assert.match(u.windows[0].display, /余额 ¥30\.15/)
    assert.match(u.windows[0].display, /赠送 ¥20\.15/)
    assert.match(u.windows[0].display, /充值 ¥10\.00/)
  })

  it("gives no used/limit pair: a prepaid balance has no window to measure", () => {
    const w = _internal.mapUsage(wallet).windows[0]
    assert.equal(w.used, undefined)
    assert.equal(w.limit, undefined)
  })

  it("is a balance the account still spends, so the window is aside", () => {
    const u = _internal.mapUsage(wallet)
    assert.equal(u.windows[0].aside, true)
  })

  it("returns an error line when the wallet call fails", () => {
    const u = _internal.mapUsage({ code: "UNAUTHORIZED", message: "未认证或登录已过期" })
    assert.ok(u.error.includes("会话"))
    assert.deepEqual(u.windows, [])
  })
})

describe("local icon", () => {
  it("reads assets/icon.png from the plugin folder and inlines it as a data URI", async () => {
    const uri = await _internal.localIcon()
    assert.ok(uri.startsWith("data:image/png;base64,"), uri.slice(0, 40))
    // a real PNG: base64 decodes to the 8-byte PNG signature
    const bytes = Buffer.from(uri.split(",")[1], "base64")
    assert.deepEqual([...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  })

  it("gives an empty icon when the file is missing, rather than throwing", async () => {
    assert.equal(await _internal.localIcon("./does-not-exist.png"), "")
  })
})
