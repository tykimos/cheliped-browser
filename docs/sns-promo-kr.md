# Cheliped Browser - SNS 홍보용 글 (한글 커뮤니티)

---

## 짧은 버전 (트위터/X, 스레드)

AI 에이전트에게 브라우저를 쥐어줬습니다.

Cheliped Browser — Chrome을 CDP로 직접 제어하고, 웹페이지를 LLM이 바로 이해할 수 있는 "Agent DOM"으로 변환합니다.

성능 비교 (16개 사이트 벤치마크):
- 토큰: 2,864 avg (Playwright 5,704 / Puppeteer 5,051 대비 2~4배 절감)
- 속도: 51ms avg (Playwright 78ms / Puppeteer 81ms)
- 인식 품질: 86.4% (Playwright 75.4% / Puppeteer 73.4%)

Claude Code, OpenClaw 스킬로 설치하면 "이 사이트 확인해줘"라고 하면 알아서 브라우징합니다.

github.com/tykimos/cheliped-browser

---

## 중간 버전 (페이스북, 링크드인)

### AI 에이전트를 위한 브라우저 자동화 스킬을 만들었습니다

AI 에이전트(Claude Code, OpenClaw 등)가 웹을 탐색할 때, 기존 도구들은 문제가 있습니다:

- Raw HTML을 그대로 넣으면? → 페이지당 3만~13만 토큰. 비용 폭발.
- 스크린샷을 찍으면? → 보이긴 하는데 클릭을 못 합니다.
- Playwright/Puppeteer를 쓰면? → CSS 셀렉터를 LLM이 직접 만들어야 합니다.

Cheliped Browser는 다른 접근을 합니다. 웹페이지를 "Agent DOM"이라는 구조화된 JSON으로 변환합니다:

```json
{
  "buttons": [{"id": 3, "text": "제출"}],
  "inputs": [{"id": 5, "placeholder": "이메일"}],
  "links": [{"id": 6, "text": "비밀번호 찾기", "href": "/reset"}]
}
```

LLM은 이걸 받고 "id 5번에 이메일 입력, id 3번 클릭"이라고 하면 됩니다. CSS 셀렉터 불필요.

16개 사이트에서 벤치마크한 결과:

| | Cheliped | Playwright | Puppeteer | agent-browser |
|--|---------|-----------|----------|--------------|
| 평균 토큰 | **2,864** | 5,704 | 5,051 | 11,882 |
| 추출 속도 | **51ms** | 78ms | 81ms | 205ms |
| 인식 품질 | **86.4%** | 75.4% | 73.4% | 72.8% |

특히 버튼 재현율 97.9%, 링크 재현율 97.3%로 실제 웹페이지의 인터랙티브 요소를 가장 잘 찾아냅니다.

설치는 한 줄:
```bash
git clone https://github.com/tykimos/cheliped-browser.git ~/.claude/skills/cheliped-browser
cd ~/.claude/skills/cheliped-browser/scripts && npm install && npm run build
```

이후 Claude Code에서 "해커뉴스 톱 뉴스 확인해줘"라고 하면 자동으로 브라우징합니다.

MIT 라이선스, 의존성은 ws 하나뿐입니다.

github.com/tykimos/cheliped-browser

---

## 긴 버전 (블로그, 커뮤니티 게시판)

### Cheliped Browser: AI 에이전트가 웹을 직접 보고 조작할 수 있게 해주는 브라우저 스킬

#### 왜 만들었나

AI 에이전트(Claude Code, OpenClaw 등)로 작업하다 보면 "이 웹사이트 확인해줘", "이 폼 작성해줘" 같은 요청이 자연스럽게 나옵니다. 문제는 LLM이 웹페이지를 직접 볼 수 없다는 것.

기존 방법들의 한계:
- **Raw HTML**: 위키피디아 한 페이지가 7만 토큰. 컨텍스트 윈도우를 날리고 비용이 폭발합니다.
- **스크린샷**: Vision 모델이 읽을 순 있지만, "저 버튼 클릭해"라고 하면 좌표를 모릅니다.
- **Playwright/Puppeteer**: 개발자가 테스트 스크립트를 쓰는 도구입니다. LLM이 `page.click('div.container > form > button:first-child')` 같은 CSS 셀렉터를 매번 만들어야 합니다.
- **접근성 트리**: 평탄하고 장황하고 상호작용 ID가 없습니다.

#### Agent DOM이라는 해결책

Cheliped는 웹페이지를 4단계 파이프라인으로 처리합니다:

```
Raw DOM → 가시 요소 필터링 → 시맨틱 그룹핑 → 토큰 압축
```

결과물인 "Agent DOM"은 LLM이 바로 이해할 수 있는 구조:

```json
{
  "buttons": [{"id": 3, "text": "로그인"}, {"id": 4, "text": "회원가입"}],
  "inputs": [{"id": 5, "placeholder": "이메일", "type": "email"}],
  "links": [{"id": 6, "text": "비밀번호 찾기", "href": "/reset"}],
  "texts": ["환영합니다! 로그인해주세요."]
}
```

LLM은 이걸 보고:
1. "이메일 입력란(id:5)에 입력하고"
2. "로그인 버튼(id:3)을 클릭"

이라고 판단하면 됩니다. CSS 셀렉터 구성 불필요, 좌표 계산 불필요.

#### 벤치마크 결과

16개 사이트(정적 HTML, SPA, 폼, 복잡한 구조, 에지케이스)에서 Playwright, Puppeteer, agent-browser와 비교했습니다.

**토큰 효율성** — LLM API 비용에 직접 영향

| 사이트 | Cheliped | Playwright | Puppeteer |
|-------|---------|-----------|----------|
| Hacker News | 2,497 | 10,014 | 4,795 |
| Wikipedia | 7,281 | 15,417 | 19,744 |
| GitHub | 3,863 | 2,347 | 1,592 |
| MDN Web Docs | 2,912 | 5,901 | 3,717 |
| **평균** | **2,864** | **5,704** | **5,051** |

대부분의 사이트에서 2~4배 적은 토큰으로 같은(또는 더 많은) 정보를 전달합니다.

**콘텐츠 인식 품질** — 실제 페이지 내용을 얼마나 정확하게 잡아내는가

| 항목 | Cheliped | Playwright | Puppeteer |
|------|---------|-----------|----------|
| 텍스트 인식률 | 80.8% | 76.8% | 76.2% |
| 링크 재현율 | **97.3%** | 85.0% | 84.2% |
| 버튼 재현율 | **97.9%** | 82.4% | 55.1% |
| 입력필드 재현율 | **67.9%** | 33.3% | 50.0% |
| 헤딩 재현율 | 89.1% | 86.4% | 86.7% |
| **종합** | **86.4%** | **75.4%** | **73.4%** |

특히 버튼(97.9%)과 링크(97.3%) 재현율이 높습니다. AI 에이전트가 "클릭할 수 있는 것"을 잘 찾아야 하니까 이 지표가 중요합니다.

**추출 속도**

| | Cheliped | Playwright | Puppeteer | agent-browser |
|--|---------|-----------|----------|--------------|
| 평균 | **51ms** | 78ms | 81ms | 205ms |

Playwright/Puppeteer 프레임워크 없이 CDP WebSocket으로 직접 통신하니 오버헤드가 적습니다.

#### Claude Code / OpenClaw 연동

**Claude Code**: `~/.claude/skills/cheliped-browser/`에 클론하면 끝. Claude가 "웹사이트 확인" 의도를 감지하면 자동으로 Cheliped를 사용합니다.

**OpenClaw**: `~/.openclaw/skills/cheliped-browser/`에 클론. 에이전트가 browser 도구를 통해 호출합니다.

실제 동작 흐름:
```
사용자: "해커뉴스 톱 3 뉴스 알려줘"
  → AI가 browsing 의도 감지 → cheliped-browser 스킬 로드
  → goto https://news.ycombinator.com → observe
  → Agent DOM 수신 → "톱 3 뉴스는: 1. ... 2. ... 3. ..."
```

#### 알려진 한계

솔직하게 말하면:
- **Cross-origin iframe**은 브라우저 보안 정책상 읽을 수 없습니다 (모든 도구 동일)
- **Twitter/YouTube 같은 인증 필요 SPA**는 모든 도구가 고전합니다
- MDN API 같은 **링크 1,000개 이상 페이지**에서는 중복 제거 후 ~500개만 반환
- **아직 초기 프로젝트**입니다. Playwright/Puppeteer의 수년간 안정성에는 못 미칩니다.

#### 설치

```bash
# Claude Code
git clone https://github.com/tykimos/cheliped-browser.git ~/.claude/skills/cheliped-browser
cd ~/.claude/skills/cheliped-browser/scripts && npm install && npm run build

# OpenClaw
git clone https://github.com/tykimos/cheliped-browser.git ~/.openclaw/skills/cheliped-browser
cd ~/.openclaw/skills/cheliped-browser/scripts && npm install && npm run build
```

MIT 라이선스. 의존성은 `ws`(WebSocket) 하나뿐.

GitHub: github.com/tykimos/cheliped-browser
