# magpie-tokenrhythm-auth

TokenRhythm（基元律动，<https://tokenrhythm.studio>）的 magpie / OpenCode 供应商插件。

登录你的 TokenRhythm API key，它的全部对话模型就能被任何 agent 使用；
平台自研的决策模型 **NeoHorse-Jev-4B** 可以当 magpie 路由组的分类器（意图识别、推理档位）。

## 安装

本地文件夹直接加载（不安装任何东西）：

```bash
magpie plugin add /path/to/magpie-tokenrhythm-auth
magpie plugin login tokenrhythm        # 粘贴 sk_tr_… 密钥
magpie provider test tokenrhythm       # ✓ chat · ✓ decide
```

之后 agent 用 `tokenrhythm/<模型>` 访问，例如 `tokenrhythm/glm-5.3`。

## 它做什么

| 能力 | 说明 |
| --- | --- |
| 登录 | API key（`Authorization: Bearer sk_tr_…`）。登录信息存在 magpie 的 `plugin-auth.json`，权限 600 |
| 对话 | OpenAI 兼容的 `POST /v1/chat/completions`；OpenAI 流式与 Anthropic Messages 网关协议都已验证 |
| 模型清单 | 每次运行时查 `GET /v1/models`，取平台的上下文长度、输出上限、工具/推理/视觉能力和实时价格；查询失败时回退到内置快照（2026-10） |
| 价格 | 平台按人民币计价，插件按固定汇率 **7.2** 换算成 magpie 用的「美元/百万 token」，并用 `effective_*`（折后价） |
| 图标 | 放在插件目录 `assets/icon.png`，由插件读成 data URI 提供（原因见下） |
| 余额 | 可选：登录时填会话令牌，`magpie quota` 显示可用 / 赠送 / 充值余额（见下） |
| JEV 决策 | `NeoHorse-Jev-4B` 声明为 System One 决策模型（`decide: true`），magpie 在 `{BASE}/systemone` 向它提问 |

### 显示余额

余额接口 `GET /api/wallet/summary` 只认网页登录的 session，**API key 调不通**（401）。
登录时第二个提问「会话令牌（可选，用于显示余额）」填 `tr_session` cookie 的值即可：

1. 浏览器打开 <https://tokenrhythm.studio/account> 并登录；
2. 开发者工具 → 应用 / 存储 → Cookie → 复制 `tr_session` 的值（`sess_…`）；
3. 重新 `magpie plugin login tokenrhythm`，按提示先填会话令牌、再填 API key。

```
$ magpie quota
tokenrhythm · API key …Sf4g  subscription  余额 余额 ¥30.15 · 赠送 ¥20.15 · 充值 ¥10.00  ¥30.15 left
```

会话令牌存在 `plugin-auth.json` 的 `metadata.session` 里；它和网页登录同寿命，过期后余额报
「会话令牌可能已过期」，重新登录即可。留空则不显示余额，对话不受影响。

### JEV 的一个适配

magpie 发给 System One 的 `choice` 题里，选项描述可能是 `null`；TokenRhythm 会因此回
`422 JEV_INVALID_REQUEST`。插件只在这种请求上把 `null`/`""` 换成选项名本身，其余字段原样透传。
平台还要求 choice 选项描述不能是空字符串——用 `null` 时插件会补成选项名，所以路由规则里的
意图名本身就是描述。

## 把 JEV 当路由组分类器

```bash
# 让 magpie 暴露决策模型（决策模型默认不出现在 agent 的模型列表里）
magpie provider models tokenrhythm +NeoHorse-Jev-4B

magpie group add my-group models=tokenrhythm/qwen3.8-flash,tokenrhythm/glm-5.3 routing=order
# 注意：effort=agent（默认）会把 classifier 清掉，所以要与 effort=auto 一起设，或先设 effort=auto
magpie group set my-group effort=auto classifier=tokenrhythm/NeoHorse-Jev-4B
magpie group rule add my-group use=tokenrhythm/glm-5.3 intent="big refactors and architecture work"
```

此后每次对话的第一个请求会让 JEV 判断意图与难度（实测约 200–300 ms），再路由到对应模型。

## 已知限制

- **JEV 在 magpie 网关里目前会报 `当前模型不支持该协议：openai`**。插件侧的请求已抓包确认
  是合法 System One 格式（直接用 curl 打同样的 body 能 200），问题在 magpie 网关调用分类器的路径，
  不在插件。对话模型不受影响。
- 余额显示依赖网页会话令牌（cookie），不是官方 API，网页改版后可能需要调整。
- Wan 3.0 视频生成与 Embeddings 不属于对话模型，插件不暴露它们。
- 价格换算按固定汇率 7.2，不是实时汇率。

## 图标

`assets/icon.png`（TokenRhythm 的 apple-touch-icon，180×180）是唯一来源：

- 插件运行 `localIcon()` 读这个文件，转成 data URI 放进 `auth.icon`，供供应商卡片使用；
- `package.json` 的 `magpie.icon` 是同一张图内联后的 data URI（7.3 KB），供插件自己的「已安装」行使用。

为什么不用路径：magpie 的图标校验（`internal/plugin/market.go` 的 `ownIcon`）只接受 `https://` 或
`data:image/`，相对路径会被静默丢弃，图标就退化成默认拼图。换成内联后图标不再依赖网络，
平台前端重新构建也不会失效。

替换图标时，改 `assets/icon.png` 后重新把它内联进 `package.json`：

```bash
node -e '
const fs=require("fs"),p=JSON.parse(fs.readFileSync("package.json","utf8"))
p.magpie.icon="data:image/png;base64,"+fs.readFileSync("assets/icon.png").toString("base64")
fs.writeFileSync("package.json",JSON.stringify(p,null,2)+"\n")'
```

## 开发

```bash
npm test        # node --test tests/plugin.test.ts（24 个测试，不联网）
```

`index.ts` 顶部导出 `_internal`（`mapModels`、`adaptSystemOneBody`、`authedFetch` 等）供测试使用；
插件入口本身是 `TokenRhythmAuthPlugin`。
