---
title: "Aider: AI 페어 프로그래머와 Git 통합 개발"
description: "오픈소스 AI 코딩 CLI Aider의 Git 자동 커밋, Architect 모드, 멀티모델 전략, .aider.conf.yml 설정을 실전 예시와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 8
type: "knowledge"
category: "AI"
tags: ["Aider", "AI코딩", "오픈소스", "페어프로그래밍", "Git통합", "ArchitectMode"]
featured: false
draft: false
---

[지난 글](/posts/ai-coding-codex/)에서 OpenAI의 Codex와 ChatGPT 계열 AI 코딩 도구를 살펴봤다. 이번엔 오픈소스 진영의 강자 **Aider**를 다룬다. Aider는 터미널에서 실행되는 AI 페어 프로그래밍 도구로, 특히 **Git과의 완벽한 통합**이 핵심 차별점이다. Claude, GPT, Gemini, 로컬 모델 등 어떤 LLM도 백엔드로 연결할 수 있어 유연성도 높다.

## Aider란

Aider(AI-assisted Developer)는 Paul Gauthier가 만든 오픈소스 CLI 도구다. 핵심 특징은 다음과 같다.

- **Git 네이티브**: 모든 코드 수정을 자동으로 git commit, /undo 가능
- **멀티모델**: Claude, GPT-4o, Gemini, Ollama 등 선택 가능
- **레포지토리 맵**: 전체 코드 구조를 LLM에 요약해 컨텍스트 효율화
- **편집 형식**: 특수한 diff 포맷으로 LLM이 정확한 파일 수정을 전달

![Aider 워크플로우](/assets/posts/ai-coding-aider-workflow.svg)

## 설치와 기본 사용

```bash
# pipx로 설치 (권장)
pipx install aider-chat

# 또는 pip
pip install aider-chat

# API 키 설정
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."

# 기본 시작 (GPT-4o)
aider

# Claude Sonnet 사용
aider --model claude-sonnet-4-6

# 특정 파일로 시작
aider app/main.py app/services/auth.py
```

시작하면 대화형 프롬프트가 나타난다. 여기서 자연어로 코드 수정을 요청하면 Aider가 LLM과 통신하고, 결과를 파일에 직접 반영한 뒤 git commit까지 자동으로 처리한다.

## Git 자동 커밋의 위력

Aider의 가장 독특한 기능이다. 코드 수정마다 의미 있는 커밋 메시지와 함께 자동 커밋이 생성된다.

```bash
$ aider app/auth.py

> JWT 토큰 만료 시간을 15분에서 1시간으로 변경해줘

Aider: 변경사항을 적용합니다...
Applied edit to app/auth.py
Commit a3f1b2c fix: JWT 토큰 만료 시간을 1시간으로 변경

> 아 15분으로 되돌려줘

Aider: /undo 하겠습니다...
/undo
Reverted commit a3f1b2c
```

실수가 있어도 `/undo`로 즉시 되돌릴 수 있어 안전하다. 또한 각 수정 단계가 git 히스토리에 명확하게 기록되어 코드 리뷰도 쉬워진다.

## 세션 내 주요 커맨드

![Aider 명령어 참조](/assets/posts/ai-coding-aider-commands.svg)

```bash
# 컨텍스트 관리
/add app/services/payment.py   # 파일을 대화에 추가
/drop app/legacy.py            # 파일 제거
/ls                            # 현재 컨텍스트 파일 목록

# 코드 vs 질문 분리
/ask JWT 토큰은 어디서 검증해?    # 수정 없이 질문만
/code 이 함수 리팩토링해줘        # 코드 수정 모드

# 실행과 검증
/run pytest tests/test_auth.py   # 명령 실행
/diff                            # 마지막 변경 diff 확인
/undo                            # 마지막 커밋 되돌리기

# Git
/git log --oneline -5            # git 명령 실행
```

## 레포지토리 맵: 대규모 코드베이스 처리

Aider의 **레포지토리 맵(Repo Map)** 기능은 대규모 프로젝트에서 Aider의 강점이다. 전체 파일을 LLM 컨텍스트에 넣는 대신, 파일별 클래스·함수 목록을 요약해 관련 파일을 자동으로 식별한다.

```bash
# 레포 맵 활성화 (기본값)
aider --map-tokens 2048

# 복잡한 프로젝트에서 더 넓은 맵
aider --map-tokens 4096 --model claude-sonnet-4-6
```

예를 들어 "결제 서비스의 환불 처리에 버그가 있어"라고 요청하면, Aider가 레포 맵을 분석해 관련된 파일(PaymentService, RefundRepository, PaymentController 등)을 자동으로 찾아 컨텍스트에 추가한다.

## Architect 모드: 2단계 모델 전략

복잡한 기능 구현에서 가장 강력한 패턴이다. 고비용의 설계 모델과 빠른 구현 모델을 분리해 품질과 비용을 동시에 최적화한다.

```bash
# Architect 모드
aider --architect \
  --model claude-opus-4-7 \
  --editor-model claude-sonnet-4-6

# 또는
aider --architect \
  --model o3 \
  --editor-model gpt-4o-mini
```

Architect 모델(Claude Opus, o3)은 설계와 접근 방법을 결정하고, Editor 모델(Claude Sonnet, GPT-4o-mini)이 실제 코드를 작성한다. 설계 작업에는 추론 능력이 중요하지만 코드 작성은 빠른 모델로 충분하기 때문에, 비용을 크게 줄이면서도 좋은 품질을 유지할 수 있다.

## .aider.conf.yml 설정

프로젝트 루트에 설정 파일을 두면 매번 옵션을 입력할 필요가 없다.

```yaml
# .aider.conf.yml
model: claude-sonnet-4-6
editor-model: claude-haiku-4-5-20251001

# Git 설정
auto-commits: true
dirty-commits: false  # 커밋 전 unstaged 변경 경고
commit-prompt: "한국어로 커밋 메시지 작성"

# 컨텍스트에 항상 포함할 파일
read:
  - README.md
  - ARCHITECTURE.md
  - .cursorrules

# 린팅 통합
lint-cmd: ruff check {files} --fix
test-cmd: pytest tests/ -v

# 레포 맵
map-tokens: 2048
```

## 실전 활용: 버그 수정 플로우

```bash
# 1. 에러 로그와 함께 시작
$ cat error.log | aider --message "이 에러를 분석하고 수정해줘"

# 2. 관련 파일 추가
/add app/services/order.py app/models/order.py

# 3. 자연어로 요청
> order_id가 None인 경우 500 에러가 나. validate 로직 추가해줘

# Aider가 수정 후 자동 커밋
Commit b2c3d4e fix: order_id None 검증 로직 추가

# 4. 테스트 실행
/run pytest tests/test_order.py -v

# 5. 테스트 실패 시 자동 수정 요청
> 위 테스트가 실패했어. 고쳐줘

# 6. 완료 후 git log 확인
/git log --oneline -5
```

## Aider vs Cursor vs Claude Code

| 항목 | Aider | Cursor | Claude Code |
|---|---|---|---|
| 인터페이스 | CLI 터미널 | GUI IDE | CLI 터미널 |
| Git 통합 | 자동 커밋 (핵심) | 수동 | 수동 |
| 모델 선택 | 최고 유연성 | 제한적 | Claude 위주 |
| 오픈소스 | ✅ 완전 오픈소스 | ❌ 프로프라이어터리 | ❌ |
| 로컬 모델 | ✅ Ollama 지원 | ✅ | ❌ |
| 에이전트 모드 | 제한적 | Composer Agent | 강력 |
| 가격 | 무료 (API 비용별도) | $20/월 | API 비용 |

Aider는 Git 히스토리를 깔끔하게 유지하면서 AI 코딩을 하고 싶은 개발자, 또는 특정 LLM에 의존하지 않고 싶은 팀에 적합하다.

---

**지난 글:** [OpenAI Codex와 ChatGPT: AI 코딩의 시작점](/posts/ai-coding-codex/)

**다음 글:** [AI 코딩 모범 사례: 생산성과 품질을 동시에 잡는 전략](/posts/ai-coding-best-practices/)

<br>
읽어주셔서 감사합니다. 😊
