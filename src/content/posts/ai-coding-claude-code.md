---
title: "Claude Code: 터미널에서 만나는 AI 소프트웨어 엔지니어"
description: "Anthropic의 Claude Code CLI 에이전트를 완전 해부합니다. 설치·CLAUDE.md 작성·에이전트 모드·MCP 통합·서브 에이전트 병렬화까지 실무 활용 전략을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 6
type: "knowledge"
category: "AI"
tags: ["ClaudeCode", "Anthropic", "AI코딩", "CLI에이전트", "CLAUDE.md", "MCP", "개발생산성"]
featured: false
draft: false
---

[지난 글](/posts/ai-coding-cursor/)에서 Cursor IDE를 살펴봤다. 이번엔 Anthropic이 직접 만든 CLI 기반 AI 에이전트, **Claude Code**를 해부한다. Claude Code는 단순한 자동완성 도구가 아니다. 터미널에서 코드를 읽고, 쓰고, 실행하며, 복잡한 소프트웨어 엔지니어링 태스크를 자율적으로 수행하는 에이전트다. 이 글을 작성하는 데도 Claude Code가 사용됐다.

## Claude Code란

Claude Code는 Anthropic이 출시한 CLI 에이전트로, Claude 모델 위에서 동작하며 다음 도구들을 기본으로 갖는다.

- **파일 시스템**: 파일 읽기·쓰기·편집·삭제
- **터미널**: 셸 명령 실행 (테스트, 빌드, 린팅)
- **웹**: URL 페치, 웹 검색
- **MCP**: 외부 서비스 연결 (GitHub, Slack, DB 등)

![Claude Code 기능 개요](/assets/posts/ai-coding-claude-code-overview.svg)

Copilot·Cursor가 IDE 내에서 작동하는 것과 달리, Claude Code는 **터미널이 주 인터페이스**다. 이 덕분에 CI/CD 파이프라인, GitHub Actions, 서버 환경에서도 자연스럽게 동작한다.

## 설치와 기본 사용

```bash
# npm으로 설치
npm install -g @anthropic-ai/claude-code

# 버전 확인
claude --version

# 대화형 세션 시작
claude

# 단일 명령 실행
claude -p "이 프로젝트의 main.py에서 발생하는 에러를 찾아 수정해줘"

# 파이프라인 활용
git diff HEAD~1 | claude -p "이 변경사항으로 커밋 메시지를 작성해줘"
cat error.log | claude -p "이 에러 로그를 분석해서 원인과 해결방법 알려줘"
```

대화형 세션에서는 자연어로 요청하면 Claude Code가 필요한 파일을 읽고, 코드를 수정하고, 테스트를 실행해 결과를 확인한다. 각 도구 사용 전에 승인을 요청하며, `-y` 플래그로 자동 승인 모드로 전환할 수 있다.

## CLAUDE.md: 프로젝트 지식 파일

**CLAUDE.md**는 Claude Code가 세션 시작마다 자동으로 읽는 파일이다. 프로젝트의 구조, 빌드 명령, 코딩 규칙, 중요한 제약사항을 여기에 기록하면 매번 설명하지 않아도 된다.

![Claude Code 명령 패턴](/assets/posts/ai-coding-claude-code-commands.svg)

```markdown
# 프로젝트: PayService API

## 빌드 명령
- 테스트: `uv run pytest tests/ -v`
- 린팅: `uv run ruff check . && uv run mypy app/`
- 실행: `uv run uvicorn app.main:app --reload`

## 아키텍처
- FastAPI + PostgreSQL (asyncpg)
- app/routers/ — HTTP 라우터만 (비즈니스 로직 금지)
- app/services/ — 비즈니스 로직
- app/repositories/ — DB 접근 계층
- app/models/ — SQLAlchemy 모델
- app/schemas/ — Pydantic 요청/응답 스키마

## 중요 규칙
- migrations/ 직접 수정 금지 → alembic으로만
- 환경변수는 app/config.py의 Settings 클래스만 통해 접근
- 모든 DB 쿼리는 Repository 계층 통해서만 실행
- 타입 힌트 100% 필수, 한국어 주석
- 비밀값 절대 코드에 하드코딩 금지

## 테스트 규칙
- 새 엔드포인트마다 pytest 통합 테스트 필수
- 목 DB: pytest-asyncio + SQLite in-memory
- 픽스처: tests/conftest.py에 정의
```

## 에이전트 모드로 복잡한 작업하기

Claude Code의 진가는 복잡한 멀티스텝 작업에서 드러난다.

```bash
# 새 기능 전체 구현 요청
claude "결제 환불 API를 구현해줘. 
POST /payments/{id}/refund 엔드포인트를 만들고,
Toss Payments 환불 API를 연동하고,
관련 테스트도 작성해줘.
완료 후 테스트를 실행해서 통과하는지 확인해줘."

# Claude Code가 자동으로:
# 1. 기존 코드 탐색 (routers, services 구조 파악)
# 2. PaymentRouter에 새 엔드포인트 추가
# 3. PaymentService에 refund 메서드 구현
# 4. Toss Payments 환불 API 문서 조회 (웹 검색)
# 5. 테스트 파일 작성
# 6. pytest 실행 → 결과 확인
# 7. 실패 시 수정 후 재실행
```

### 서브 에이전트 병렬화

Claude Code는 독립적인 작업을 여러 서브 에이전트로 병렬 실행할 수 있다.

```python
# claude SDK로 병렬 작업 실행
import anthropic

client = anthropic.Anthropic()

# 여러 파일을 동시에 분석
tasks = [
    "app/routers/payments.py를 분석해서 보안 취약점 보고",
    "app/services/user_service.py를 분석해서 성능 개선점 보고",
    "tests/ 디렉터리를 분석해서 테스트 커버리지 부족한 부분 보고",
]

# 각 태스크를 독립 에이전트로 실행 (병렬 처리)
for task in tasks:
    result = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        messages=[{"role": "user", "content": task}]
    )
    print(result.content[0].text)
```

## MCP로 도구 생태계 확장

MCP(Model Context Protocol)를 통해 Claude Code의 도구 범위를 무한히 확장할 수 있다.

```bash
# MCP 서버 설정 (claude_desktop_config.json 또는 .claude/mcp.json)
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..."
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "POSTGRES_CONNECTION_STRING": "postgresql://..."
      }
    }
  }
}
```

MCP가 연결되면 Claude Code가 직접 GitHub PR을 읽고, DB 쿼리를 실행하고, Slack 메시지를 보낼 수 있다.

```bash
# MCP 연결 후 사용 예시
claude "main 브랜치의 최근 PR 목록을 보여주고,
각 PR에서 리뷰가 필요한 코드를 요약해줘"

claude "users 테이블에서 이번 주 가입한 사용자 수를 
DB에서 직접 조회해서 알려줘"
```

## 권한 관리와 보안

Claude Code는 기본적으로 민감한 작업 전에 사용자 확인을 요청한다.

```bash
# .claude/settings.json으로 권한 설정
{
  "permissions": {
    "allow": [
      "Bash(npm run *)",
      "Bash(pytest *)",
      "Bash(ruff *)",
      "Read(*)",
      "Edit(src/**)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(git push --force *)"
    ]
  }
}
```

### Hooks: 자동화 통합

```json
// .claude/settings.json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit",
      "hooks": [{
        "type": "command",
        "command": "ruff check ${file} --fix"
      }]
    }],
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "pytest tests/ -q"
      }]
    }]
  }
}
```

이렇게 설정하면 파일을 편집할 때마다 자동으로 린터가 실행되고, 세션이 끝날 때 테스트가 자동으로 돌아간다.

## GitHub Actions에서 Claude Code

CI/CD 파이프라인에도 통합할 수 있다.

```yaml
# .github/workflows/ai-review.yml
name: AI Code Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Claude Code Review
        uses: anthropics/claude-code-action@beta
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: |
            이 PR의 변경사항을 검토하고:
            1. 잠재적 버그나 보안 취약점 지적
            2. 성능 개선 제안
            3. 코딩 컨벤션 위반 사항
            결과를 PR 코멘트로 남겨줘.
```

---

**지난 글:** [Cursor: AI 네이티브 IDE의 새로운 기준](/posts/ai-coding-cursor/)

**다음 글:** [OpenAI Codex와 ChatGPT: AI 코딩의 시작점](/posts/ai-coding-codex/)

<br>
읽어주셔서 감사합니다. 😊
