---
title: "히스토리에 유출된 비밀정보 제거하기"
description: "API 키·비밀번호가 커밋에 새어 들어갔을 때의 대응 순서를 설명한다. 키 폐기·재발급이 히스토리 청소보다 먼저인 이유, git filter-repo로 비밀 파일과 문자열을 제거하는 방법, 강제 푸시 후 협업자 대응과 재발 방지 장치를 다룬다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 6
type: "knowledge"
category: "Git"
tags: ["Git", "보안", "filter-repo", "비밀정보", "히스토리", "유출"]
featured: false
draft: false
---

[지난 글](/posts/git-large-binary-mistake/)에서 대용량 바이너리를 히스토리에서 제거하는 법을 다뤘다. 같은 재작성 기술이 훨씬 다급하게 필요한 상황이 있다. **API 키나 비밀번호, `.env` 파일이 커밋에 섞여 들어가 푸시된 경우**다. 이때 가장 위험한 오해는 "히스토리에서 지우면 끝"이라는 생각이다. 비밀정보 사고는 청소보다 먼저 해야 할 일이 따로 있다. 순서를 잘못 잡으면 청소를 끝내고도 이미 유출된 키로 침해를 당할 수 있다.

## 순서가 전부다

대응은 세 단계이며, **순서를 지키는 것**이 핵심이다.

![비밀정보 유출 대응의 세 단계](/assets/posts/git-secret-leak-cleanup-priority.svg)

1. **즉시 폐기·재발급.** 유출된 키·토큰·비밀번호를 무효화하고 새로 발급한다.
2. **히스토리 청소.** 과거 커밋에서 비밀 파일·문자열을 제거한다.
3. **재발 방지.** `.gitignore`와 사전 스캔으로 다시 새지 않게 한다.

왜 폐기가 먼저인가? push된 순간, 특히 공개 저장소라면 자동 봇이 몇 초 만에 키를 수집한다고 봐야 한다. 누군가 이미 `clone`이나 `fork`로 복사해 갔을 수도 있다. 히스토리를 아무리 깨끗이 청소해도 **이미 노출된 값 자체는 되돌릴 수 없다.** 그래서 "그 키는 더 이상 유효하지 않다"는 상태를 만드는 것이 1순위다.

## 1단계: 즉시 폐기·재발급

키 종류에 따라 발급처에서 무효화한다. AWS 액세스 키, GitHub 토큰, OAuth 시크릿, DB 비밀번호 등 각각의 콘솔에서 해당 자격증명을 비활성화하고 새 값을 발급한 뒤, 운영 환경의 환경 변수나 시크릿 매니저를 갱신한다. 이 단계가 끝나기 전까지 저장소 청소는 의미가 없다.

## 2단계: 히스토리에서 제거

키를 무력화했다면 이제 흔적을 지운다. 파일 통째로 새어 들어갔다면 경로 단위로 제거한다.

![filter-repo로 비밀 파일·문자열 제거](/assets/posts/git-secret-leak-cleanup-commands.svg)

```bash
# .env 파일을 전체 히스토리에서 삭제
git filter-repo --path .env --invert-paths
```

소스 코드 줄에 키가 하드코딩됐다면 파일은 남기고 **값만 치환**해야 한다. `--replace-text`에 패턴 파일을 넘긴다.

```bash
# patterns.txt 내용 예시 (한 줄에 하나):
#   AKIAIOSFODNN7EXAMPLE==>REMOVED
#   regex:password\s*=\s*".*"==>password="REDACTED"
git filter-repo --replace-text patterns.txt
```

`regex:` 접두사를 쓰면 정규식으로 매칭한다. `==>` 뒤가 치환될 대체 문자열이다.

그다음 재작성된 히스토리를 강제로 푸시한다.

```bash
git push origin --force --all
git push origin --force --tags
```

## 3단계: 협업자 대응과 재발 방지

강제 푸시 후 모든 협업자는 기존 clone을 버리고 새로 받아야 한다. 옛 clone에는 여전히 비밀이 남아 있기 때문이다. 팀에 공지하고, 가능하면 오래된 fork도 정리하도록 요청한다.

재발을 막는 가장 확실한 방법은 **애초에 커밋되지 않게** 하는 것이다.

```gitignore
# 비밀 설정은 추적 금지
.env
.env.*
*.pem
secrets.yml
```

여기에 커밋 직전 자동 스캔을 더하면 안전망이 두꺼워진다. `pre-commit` 훅으로 비밀 패턴을 검사하는 도구를 붙여 두자.

```bash
# 예: gitleaks를 pre-commit 단계에서 실행
gitleaks protect --staged --verbose
```

> GitHub를 쓴다면 Push Protection과 Secret Scanning을 켜 두는 것도 강력한 보완책이다. 알려진 키 패턴이 푸시 단계에서 차단된다.

정리하면 비밀정보 유출은 **폐기 → 청소 → 예방** 순서가 생명이다. 청소는 흔적을 줄일 뿐, 이미 노출된 값을 무효화하는 것은 오직 재발급뿐임을 기억하자. 다음 글부터는 보안에서 한 걸음 물러나, 운영 중 자주 부딪히는 줄바꿈(CRLF/LF) 문제를 다룬다.

---

**지난 글:** [대용량 바이너리를 실수로 커밋했을 때](/posts/git-large-binary-mistake/)

**다음 글:** [줄바꿈(CRLF/LF) 문제 깔끔하게 해결하기](/posts/git-line-ending-issues/)

<br>
읽어주셔서 감사합니다. 😊
