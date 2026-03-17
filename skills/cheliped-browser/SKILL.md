---
name: cheliped-browser
description: "Agent Browser Runtime - browse, observe, and interact with web pages via CDP"
version: 1.0.0
user-invocable: true
metadata: {"openclaw":{"requires":{"bins":["node"],"env":[]},"install":[{"kind":"node","package":"cheliped-browser"}]}}
---

# cheliped-browser — Agent Browser Runtime

Cheliped is a browser automation runtime designed for AI agents. It controls Chrome via the Chrome DevTools Protocol (CDP) and exposes an LLM-friendly view of web pages called **Agent DOM** — a compressed, semantically structured representation that strips visual noise and reduces token usage.

## Quick Start

All browser interactions go through the CLI wrapper `cheliped-cli.mjs`. Each invocation accepts a JSON array of commands to execute in sequence:

```bash
node cheliped-cli.mjs '[{"cmd":"goto","args":["https://example.com"]},{"cmd":"observe"}]'
```

The first call launches Chrome automatically and saves a session to `/tmp/cheliped-session-default.json`. Subsequent calls reconnect to the same Chrome instance. Call `close` when done.

### Concurrent Usage
여러 에이전트가 동시에 브라우저를 사용할 때는 `--session` 플래그로 세션을 분리합니다.
```bash
node cheliped-cli.mjs --session agent1 '[{"cmd":"goto","args":["https://example.com"]}]'
node cheliped-cli.mjs --session agent2 '[{"cmd":"goto","args":["https://other.com"]}]'
```
각 세션은 독립적인 Chrome 인스턴스를 사용합니다.

## Available Commands

### `launch`
명시적으로 Chrome을 실행합니다. 첫 번째 명령이 자동으로 실행하므로 보통 생략 가능합니다.
```bash
node cheliped-cli.mjs '[{"cmd":"launch"}]'
```

### `goto`
URL로 이동합니다. 페이지 로드 완료까지 대기합니다.
```bash
node cheliped-cli.mjs '[{"cmd":"goto","args":["https://news.ycombinator.com"]}]'
```
Returns: `{ success: true, url, title }`

### `observe`
현재 페이지의 **Agent DOM**을 추출합니다. Agent DOM은 LLM이 이해하기 쉽도록 압축된 DOM 표현으로, 각 인터랙티브 요소에 숫자 ID(`agentId`)가 부여됩니다.
```bash
node cheliped-cli.mjs '[{"cmd":"observe"}]'
```
Returns: `{ nodes: [...], texts: [...], links: [...] }` — `nodes[].id`를 `click`/`fill`에 사용합니다.

### `observe-graph`
페이지의 **UI 그래프**를 반환합니다. 노드, 엣지, 폼 그룹으로 구성된 시맨틱 구조입니다.
```bash
node cheliped-cli.mjs '[{"cmd":"observe-graph"}]'
```
Returns: `{ nodes: [...], edges: [...], forms: [...] }`

### `actions`
페이지에서 수행 가능한 **시맨틱 액션** 목록을 반환합니다. UI 그래프를 분석하여 로그인, 검색, 제출 등의 고수준 동작을 자동으로 감지합니다.
```bash
node cheliped-cli.mjs '[{"cmd":"actions"}]'
```
Returns: `[{ id, type, label, confidence, params, triggerNodeId }, ...]`

### `click`
Agent DOM ID로 요소를 클릭합니다. 반드시 `observe` 또는 `observe-graph`를 먼저 호출해야 합니다.
```bash
node cheliped-cli.mjs '[{"cmd":"observe"},{"cmd":"click","args":["42"]}]'
```
Returns: `{ success: true, action: "click", agentId: 42 }`

### `fill`
Agent DOM ID로 입력 필드에 텍스트를 입력합니다. React 앱의 synthetic event도 처리합니다.
```bash
node cheliped-cli.mjs '[{"cmd":"observe"},{"cmd":"fill","args":["7","hello world"]}]'
```
Returns: `{ success: true, action: "fill", agentId: 7 }`

### `perform`
시맨틱 액션 ID로 고수준 동작을 실행합니다. `actions`에서 얻은 ID와 파라미터를 사용합니다.
```bash
node cheliped-cli.mjs '[{"cmd":"actions"},{"cmd":"perform","args":["login"],{"params":{"username":"user@example.com","password":"secret"}}}]'
```
`perform` 명령의 세 번째 요소는 선택적 파라미터 객체입니다:
```json
{ "cmd": "perform", "args": ["action-id"], "params": { "fieldName": "value" } }
```
Returns: `{ success: true, actionId, actionType }`

### `screenshot`
현재 화면을 PNG로 저장합니다. 파일명을 지정하지 않으면 `/tmp/cheliped-screenshot.png`에 저장됩니다.
```bash
node cheliped-cli.mjs '[{"cmd":"screenshot","args":["/tmp/page.png"]}]'
```
Returns: `{ success: true, path: "/tmp/page.png", size: 12345 }`

### `run-js`
JavaScript 코드를 페이지 컨텍스트에서 실행하고 결과를 반환합니다.
```bash
node cheliped-cli.mjs '[{"cmd":"run-js","args":["document.title"]}]'
```
Returns: `{ success: true, result: "Page Title" }`

### `extract`
페이지에서 특정 데이터를 추출합니다. 타입: `text`, `links`, `all`
```bash
node cheliped-cli.mjs '[{"cmd":"extract","args":["links"]}]'
```
Returns: `{ type: "links", data: [...] }`

### `close`
Chrome을 종료하고 세션 파일을 삭제합니다.
```bash
node cheliped-cli.mjs '[{"cmd":"close"}]'
```

---

## The Observe-Act Loop

The core pattern for interacting with any web page:

```
1. goto <url>            → 페이지 로드
2. observe               → Agent DOM 추출, agentId 확인
3. 목표 달성에 필요한 요소의 agentId 파악
4. click / fill          → 액션 수행
5. observe               → 변경된 페이지 상태 재확인
6. 반복
```

### Example: Search on Hacker News

```bash
# 단일 호출로 여러 명령 실행
node cheliped-cli.mjs '[
  {"cmd":"goto","args":["https://news.ycombinator.com"]},
  {"cmd":"observe"}
]'

# observe 결과에서 검색 입력창의 agentId를 확인한 후:
node cheliped-cli.mjs '[
  {"cmd":"fill","args":["3","cheliped"]},
  {"cmd":"click","args":["4"]},
  {"cmd":"observe"}
]'
```

### Example: Using Semantic Actions (High-level)

```bash
# 페이지의 가능한 액션 목록 확인
node cheliped-cli.mjs '[
  {"cmd":"goto","args":["https://example.com/login"]},
  {"cmd":"actions"}
]'

# 반환된 액션 ID로 실행 (파라미터 포함)
node cheliped-cli.mjs '[
  {"cmd":"perform","args":["login-form"],"params":{"email":"user@example.com","password":"pass123"}}
]'
```

---

## Tips

- **React/SPA 사이트**: `fill` 명령은 React의 synthetic event 시스템을 우회하는 native setter를 사용하므로 React 앱에서도 정상 동작합니다.
- **Instagram 등 인증 필요 사이트**: `session` 옵션으로 쿠키를 영구 저장하여 로그인 상태를 유지할 수 있습니다 (고급 사용법).
- **토큰 절약**: Agent DOM은 기본적으로 압축되어 있습니다. `observe`의 결과물은 원시 HTML보다 훨씬 적은 토큰을 사용합니다.
- **보안 정책**: 허용 도메인 화이트리스트, 프롬프트 인젝션 감지, 데이터 유출 방지 기능이 내장되어 있습니다 (고급 옵션).
- **agentId 유효성**: `observe` 또는 `observe-graph` 호출 후에만 `agentId`가 유효합니다. 페이지가 변경되면 재관찰이 필요합니다.
- **세션 유지**: Chrome은 `close`를 호출하기 전까지 백그라운드에서 실행 상태를 유지합니다. 여러 명령을 순차적으로 실행할 때 매번 브라우저를 재시작하지 않아도 됩니다.

---

## Output Format

모든 명령은 JSON을 stdout으로 출력합니다. 오류 발생 시:
```json
{ "error": "오류 메시지", "command": "실패한 명령" }
```

성공 시 각 명령 결과가 배열로 반환됩니다:
```json
[
  { "cmd": "goto", "result": { "success": true, "url": "...", "title": "..." } },
  { "cmd": "observe", "result": { "nodes": [...], "texts": [...], "links": [...] } }
]
```
