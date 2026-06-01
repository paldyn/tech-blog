---
title: "줄바꿈(CRLF/LF) 문제 깔끔하게 해결하기"
description: "Windows의 CRLF와 Unix의 LF 차이로 diff가 전부 변경으로 표시되는 줄바꿈 문제의 원인과, .gitattributes로 저장소 규칙을 고정하는 방법, core.autocrlf 설정, 이미 섞인 파일을 renormalize로 통일하는 절차를 설명한다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 7
type: "knowledge"
category: "Git"
tags: ["Git", "gitattributes", "CRLF", "LF", "줄바꿈", "협업"]
featured: false
draft: false
---

[지난 글](/posts/git-secret-leak-cleanup/)에서 유출된 비밀정보를 히스토리에서 제거하는 법을 다뤘다. 이번에는 보안과는 다른 결의, 그러나 윈도우·맥·리눅스가 섞인 팀이라면 거의 반드시 겪는 골칫거리를 본다. 분명 한 줄도 안 고쳤는데 `git diff`가 **파일 전체를 변경으로 표시**하는 경우다. 범인은 대개 줄바꿈 문자다. 원인을 이해하고 `.gitattributes`로 한 번에 정리하는 방법을 살펴보자.

## 왜 파일 전체가 바뀐 것처럼 보일까

운영체제마다 텍스트 파일의 줄 끝 표기가 다르다. Windows는 캐리지 리턴과 라인 피드 두 글자(`CRLF`, `\r\n`)를, macOS·Linux는 라인 피드 한 글자(`LF`, `\n`)를 쓴다. Git은 줄 끝까지 바이트 단위로 비교하므로, LF로 저장된 파일을 Windows 편집기가 CRLF로 바꿔 저장하면 **모든 줄이 달라진 것**으로 인식한다.

![CRLF와 LF 차이로 diff 전체가 변경으로 표시](/assets/posts/git-line-ending-issues-crlf.svg)

이 상태로 커밋하면 실제 코드 변경은 한 줄인데 diff에는 수백 줄이 빨강·초록으로 뒤덮인다. 리뷰가 불가능해지고, 잦은 줄바꿈 충돌이 일어난다.

## 해결의 핵심: .gitattributes로 규칙 고정

가장 견고한 해법은 **저장소 안에 규칙을 박아 두는** 것이다. 개인별 설정(`core.autocrlf`)에 의존하면 사람마다 동작이 달라지지만, `.gitattributes`는 저장소를 받는 모든 사람에게 동일하게 적용된다.

```gitattributes
# 저장소에는 항상 LF로 저장, 텍스트 여부는 Git이 자동 판단
* text=auto eol=lf

# 셸 스크립트는 무조건 LF (CRLF면 실행 깨짐)
*.sh text eol=lf

# 윈도우 배치 파일은 CRLF 유지
*.bat text eol=crlf

# 바이너리는 절대 변환하지 않음
*.png binary
*.jar binary
```

`text=auto`는 Git이 파일을 텍스트로 판단하면 저장소에 LF로 정규화해 저장한다는 뜻이다. `eol=lf`는 체크아웃할 때도 LF로 내려 준다. 한 번 커밋해 두면 팀 전체가 같은 규칙을 따른다.

## 개인 설정: core.autocrlf

`.gitattributes`가 없을 때의 보조 수단이 `core.autocrlf`다. 다만 사람마다 달라질 수 있으니 가능하면 `.gitattributes`를 우선한다.

```bash
# Windows: 체크아웃 시 CRLF, 커밋 시 LF로 변환
git config --global core.autocrlf true

# macOS/Linux: 커밋 시 LF로만 정리 (CRLF 유입 차단)
git config --global core.autocrlf input
```

섞인 줄바꿈을 경고로 잡고 싶다면 `core.safecrlf`를 켜 둘 수 있다.

```bash
git config --global core.safecrlf warn
```

## 이미 섞여 버린 파일 정규화하기

규칙을 정하기 전에 들어온 파일들은 여전히 CRLF가 섞여 있을 수 있다. `.gitattributes`를 커밋한 뒤, 인덱스를 다시 정규화하면 한 번에 통일된다.

![renormalize로 기존 파일을 한 번에 통일](/assets/posts/git-line-ending-issues-renormalize.svg)

```bash
# 1) 규칙 파일을 먼저 커밋
git add .gitattributes
git commit -m "chore: add .gitattributes for line endings"

# 2) 모든 파일을 새 규칙에 맞춰 다시 스테이징
git add --renormalize .

# 3) 정규화 결과를 하나의 커밋으로 남긴다
git commit -m "chore: normalize line endings to LF"
```

`--renormalize`는 작업 트리는 그대로 두고 인덱스의 줄바꿈만 규칙대로 다시 계산한다. 이 정규화 커밋을 한 번 남겨 두면, 이후 diff에서 줄바꿈 잡음이 사라진다.

## 확인하기

정규화가 잘 됐는지 의심스러우면 특정 파일의 저장소 내부 줄바꿈을 직접 확인할 수 있다.

```bash
# 인덱스에 저장된 형태를 그대로 출력해 \r 여부 점검
git show :path/to/file.js | cat -A | grep -c '\^M'
```

출력이 0이면 CRLF가 없는 깨끗한 LF 상태다. 정리하면 줄바꿈 문제는 **`.gitattributes`로 규칙을 고정하고, `--renormalize`로 기존 파일을 한 번 통일**하면 거의 끝난다. 다음 글에서는 또 다른 OS 차이에서 오는 함정, 파일명 대소문자 문제를 다룬다.

---

**지난 글:** [히스토리에 유출된 비밀정보 제거하기](/posts/git-secret-leak-cleanup/)

**다음 글:** [파일명 대소문자 문제 다루기](/posts/git-case-sensitivity/)

<br>
읽어주셔서 감사합니다. 😊
