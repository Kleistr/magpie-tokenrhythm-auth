import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  accountsOf,
  pickAccount,
  withSession,
  maskSession,
  authPath,
} from "../scripts/session-token.mjs"

const TWO = "tokenrhythm" + "#" + "2"
const NINE = "tokenrhythm" + "#" + "9"

const auth = {
  tokenrhythm: {
    type: "api",
    key: "sk_tr_one",
    metadata: { balance: "on", session: "sess_old" },
  },
  [TWO]: {
    type: "api",
    key: "sk_tr_two",
    metadata: { session: "sess_two" },
  },
  other: { type: "api", key: "sk_other" },
}

describe("accountsOf", () => {
  it("finds every tokenrhythm account and nothing else", () => {
    assert.deepEqual(
      accountsOf(auth).map((a) => a.key),
      ["tokenrhythm", TWO],
    )
  })

  it("finds none in an auth file without the provider", () => {
    assert.deepEqual(accountsOf({ other: { type: "api", key: "k" } }), [])
  })
})

describe("pickAccount", () => {
  const accounts = accountsOf(auth)

  it("takes the only account when none is named", () => {
    assert.equal(pickAccount(accountsOf({ tokenrhythm: auth.tokenrhythm }), "").key, "tokenrhythm")
  })

  it("refuses to guess between several, and names them", () => {
    const r = pickAccount(accounts, "")
    assert.ok(r.error)
    assert.match(r.error, /--account/)
    assert.match(r.error, /tokenrhythm/)
  })

  it("takes one by key, by its end, or by its number", () => {
    assert.equal(pickAccount(accounts, TWO).key, TWO)
    assert.equal(pickAccount(accounts, "…two").key, TWO)
    assert.equal(pickAccount(accounts, "2").key, TWO)
  })

  it("says so when the account named is not there", () => {
    assert.match(pickAccount(accounts, NINE).error, /没有/)
  })
})

describe("withSession", () => {
  it("replaces only that account's session, keeping its key and other metadata", () => {
    const out = withSession(auth, "tokenrhythm", "sess_new")
    assert.equal(out.tokenrhythm.key, "sk_tr_one")
    assert.equal(out.tokenrhythm.metadata.session, "sess_new")
    assert.equal(out.tokenrhythm.metadata.balance, "on")
    assert.equal(out[TWO].metadata.session, "sess_two")
    assert.deepEqual(out.other, auth.other)
  })

  it("does not mutate the object it is given", () => {
    withSession(auth, "tokenrhythm", "sess_new")
    assert.equal(auth.tokenrhythm.metadata.session, "sess_old")
  })

  it("clears the session with null, and drops an empty metadata", () => {
    const out = withSession(auth, TWO, null)
    assert.equal(out[TWO].metadata, undefined)
    assert.equal(out[TWO].key, "sk_tr_two")
  })

  it("refuses an account it does not know", () => {
    assert.match(withSession(auth, NINE, "sess_x").error, /没有/)
  })
})

describe("maskSession", () => {
  it("shows only the tail, enough to tell two apart", () => {
    assert.equal(maskSession("sess_abcdefghijkl"), "sess_…ijkl")
  })
})

describe("authPath", () => {
  it("follows XDG_CONFIG_HOME, as magpie does", () => {
    assert.equal(authPath({ XDG_CONFIG_HOME: "/x/cfg" }), "/x/cfg/magpie/plugin-auth.json")
  })

  it("falls back to ~/.config/magpie", () => {
    assert.match(authPath({ HOME: "/home/me" }), /\/home\/me\/\.config\/magpie\/plugin-auth\.json$/)
  })
})
