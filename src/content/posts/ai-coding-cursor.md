---
title: "Cursor: AI 네이티브 IDE의 새로운 기준"
description: "VS Code 포크 기반의 Cursor가 Tab 자동완성·Chat·Composer·Agent 모드로 개발 흐름을 어떻게 바꾸는지, .cursorrules 작성법부터 Agent 실전 활용까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 5
type: "knowledge"
category: "AI"
tags: ["Cursor", "AI코딩", "CursorIDE", "Composer", "CursorRules", "개발생산성"]
featured: false
draft: false
---

[지난 글](/posts/ai-coding-copilot/)에서 GitHub Copilot의 작동 원리를 살펴봤다. Copilot이 기존 IDE에 AI를 '추가'하는 방식이라면, **Cursor**는 IDE 자체를 AI 중심으로 설계한 접근이다. VS Code를 포크해 친숙한 인터페이스를 유지하면서, AI 기능을 에디터 깊숙이 통합했다. 2024년 이후 많은 개발자들이 Copilot에서 Cursor로 전환한 이유가 여기에 있다.

## Cursor가 다른 이유

Cursor와 Copilot의 가장 큰 차이는 **컨텍스트 활용 방식**이다.

Copilot은 현재 파일과 열린 탭을 기반으로 완성을 제안하지만, Cursor는 `@codebase` 명령으로 **전체 프로젝트를 벡터 인덱싱**해 어떤 파일도 시맨틱하게 검색하고 참조할 수 있다. 수천 개 파일의 프로젝트에서도 관련 코드를 자동으로 찾아 컨텍스트로 포함한다.

또한 Cursor는 사용할 AI 모델을 직접 선택할 수 있다. Claude 4 Sonnet, GPT-4o, Gemini 2.5 Pro 등을 작업 성격에 맞게 선택하거나, 로컬에서 Ollama 모델을 연결할 수도 있다.

## 4가지 핵심 기능

![Cursor IDE 기능 구조](/assets/posts/ai-coding-cursor-features.svg)

### Tab 자동완성

Copilot과 비슷하게 인라인 제안이 나타나지만, Cursor의 Tab은 **멀티라인 편집 예측**이 특기다. 변수 이름을 바꾸거나 함수 시그니처를 수정하면, 연관된 다른 부분의 수정 제안도 함께 나타난다. Tab을 한 번 누르면 해당 제안만, 계속 누르면 다음 제안으로 이동한다.

### Chat 패널 (Ctrl+L)

```
@codebase 인증 관련 코드 어디에 있어?
@file:services/auth.py 이 코드에서 refreshToken 로직 설명해줘
@web https://fastapi.tiangolo.com/tutorial/security/ 참고해서 OAuth2 구현해줘
@docs 우리 API 문서에서 결제 관련 엔드포인트 목록 알려줘
```

`@web`으로 실시간 웹 검색, `@docs`로 프로젝트 문서 참조가 가능하다.

### Composer (Ctrl+I)

여러 파일에 걸친 작업을 자연어로 요청한다. Normal 모드와 Agent 모드가 있다.

**Normal 모드**: 파일 수정안을 보여주고 사람이 검토 후 적용.

**Agent 모드**: 파일 생성·수정, 터미널 명령 실행, 검색까지 자율 실행.

### @ 컨텍스트 시스템

| 명령 | 설명 |
|---|---|
| `@file` | 특정 파일 참조 |
| `@folder` | 폴더 전체 참조 |
| `@codebase` | 프로젝트 전체 시맨틱 검색 |
| `@web` | 실시간 웹 검색 |
| `@docs` | 라이브러리 공식 문서 |
| `@git` | git 로그·diff 참조 |

## .cursorrules 작성 전략

`.cursor/rules` 파일(또는 구버전 `.cursorrules`)은 프로젝트의 AI 동작 지침이다. 잘 작성된 rules 파일 하나가 프롬프트마다 설명하는 수고를 줄여준다.

![Cursor 핵심 사용법](/assets/posts/ai-coding-cursor-modes.svg)

```markdown
# Project Rules for Cursor

## 기술 스택
- Python 3.11 (엄격한 타입 힌트 필수)
- FastAPI 0.110 + Pydantic v2
- SQLAlchemy 2.0 (비동기 세션 사용)
- PostgreSQL (psycopg3)

## 코딩 컨벤션
- 함수: snake_case, 클래스: PascalCase
- 주석: 한국어
- docstring: Google 스타일
- 에러 처리: `raise HTTPException(status_code=..., detail=...)` 사용
- 로깅: `logger = logging.getLogger(__name__)` 패턴

## 금지 패턴
- `print()` 절대 금지 → logging 사용
- `SELECT *` 금지 → 컬럼 명시
- 하드코딩 비밀번호·API 키 금지

## 디렉터리 구조
- `app/routers/` — FastAPI 라우터
- `app/services/` — 비즈니스 로직
- `app/models/` — SQLAlchemy 모델
- `app/schemas/` — Pydantic 스키마
- `tests/` — pytest 테스트

## 테스트 규칙
- 모든 라우터에 pytest + httpx AsyncClient 테스트 필수
- 픽스처는 conftest.py에 정의
```

## Composer Agent 실전 사용

Agent 모드로 복잡한 기능을 한 번에 요청하는 패턴이다.

```python
# Composer에 입력하는 요청 예시

"""
결제 처리 기능을 구현해줘.

요구사항:
1. POST /payments 엔드포인트
2. Toss Payments API 연동 (@web https://docs.tosspayments.com/)
3. 결제 성공/실패 웹훅 처리
4. 결제 내역 DB 저장 (payments 테이블)
5. 실패 시 자동 3회 재시도

@file:app/models/user.py 의 User 모델 참고
@file:app/routers/orders.py 의 라우터 패턴 따라서

테스트 코드도 같이 만들어줘.
"""

# Agent가 생성하는 파일들:
# - app/routers/payments.py
# - app/services/payment_service.py
# - app/schemas/payment.py
# - app/models/payment.py
# - tests/test_payments.py
# - migrations/xxx_add_payments_table.py
```

## Cursor vs Copilot 실용 비교

| 항목 | Cursor | Copilot |
|---|---|---|
| 기반 | VS Code 포크 (별도 설치) | 익스텐션 (기존 IDE 유지) |
| 모델 선택 | 자유 (Claude, GPT, Gemini 등) | GPT-4o / Sonnet 위주 |
| 코드베이스 인덱싱 | @codebase (전체) | 열린 탭 한정 |
| 멀티파일 편집 | Composer (강점) | Copilot Edits |
| 로컬 모델 | 지원 (Ollama) | 미지원 |
| 가격 | $20/월 (Pro) | $19/월 (Individual) |

Cursor의 강점은 대규모 프로젝트에서 "맥락을 잃지 않는" 능력이다. 수백 개 파일이 있어도 `@codebase`로 전체를 검색하고, Composer Agent로 여러 파일을 일관된 방식으로 수정할 수 있다.

## 실무 팁: Privacy Mode

Cursor는 기본적으로 코드를 서버에 전송한다. 기업 코드 보안이 걱정된다면 **Settings → Privacy → Privacy Mode**를 활성화하면 코드가 모델 학습에 사용되지 않으며, SOC2 준수 처리된다. 혹은 Self-hosted 환경에서 Ollama와 연결해 완전히 로컬로 사용하는 방법도 있다.

---

**지난 글:** [AI 코딩 도구의 시대: GitHub Copilot 완전 해부](/posts/ai-coding-copilot/)

**다음 글:** [Claude Code: 터미널에서 만나는 AI 소프트웨어 엔지니어](/posts/ai-coding-claude-code/)

<br>
읽어주셔서 감사합니다. 😊
