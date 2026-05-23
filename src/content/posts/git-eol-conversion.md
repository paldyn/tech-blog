---
title: "Git 줄 끝 변환: CRLF와 LF 혼용 문제 완전 해결"
description: "Windows CRLF와 Unix LF가 섞였을 때 발생하는 거짓 diff 문제를 core.autocrlf 설정과 .gitattributes로 팀 전체에 일관되게 해결하는 방법을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 9
type: "knowledge"
category: "Git"
tags: ["Git", "EOL", "CRLF", "LF", "autocrlf", "gitattributes", "줄끝"]
featured: false
draft: false
---

[지난 글](/posts/git-keep-empty-dir/)에서 빈 디렉터리를 Git에 유지하는 방법을 알아봤다. 이번에는 크로스 플랫폼 팀에서 자주 겪는 줄 끝(line ending) 혼용 문제와 해결 방법을 살펴본다.

## 문제: 줄 끝 차이

운영체제마다 텍스트 파일의 줄 끝 문자가 다르다.

- **Windows**: `CRLF` (`\r\n`, 0x0D 0x0A)
- **macOS / Linux**: `LF` (`\n`, 0x0A)

![플랫폼별 줄 끝 차이](/assets/posts/git-eol-conversion-platforms.svg)

Windows 개발자가 파일을 편집하면 `\r\n`으로 저장된다. 이 파일을 macOS 개발자가 받으면 `\r`이 추가되거나 제거되어 내용 변경 없이 전체 파일이 diff에 나타난다. 코드 리뷰가 불가능해지고, blame 이력이 의미 없어진다.

## core.autocrlf: 개인 설정

`core.autocrlf`는 Git이 체크아웃·커밋 시 줄 끝을 어떻게 변환할지 지정한다.

```bash
# Windows: 체크아웃 시 LF → CRLF, 커밋 시 CRLF → LF
git config --global core.autocrlf true

# macOS / Linux: 체크아웃 변환 없음, 커밋 시 CRLF → LF (혹시 있다면)
git config --global core.autocrlf input

# 변환 없음 (비권장 — 혼용 가능성 있음)
git config --global core.autocrlf false
```

![core.autocrlf 동작 방식](/assets/posts/git-eol-conversion-settings.svg)

`core.autocrlf true`(Windows)로 설정하면 저장소에는 항상 LF가 저장되고, 로컬 워킹 트리에서는 CRLF로 받는다. 이것이 Windows에서의 표준 권장 설정이다.

## 더 나은 방법: .gitattributes로 저장소 고정

`core.autocrlf`는 개인 설정이라 팀원마다 다를 수 있다. 누군가 설정을 잊으면 문제가 재발한다. **`.gitattributes`로 저장소 레벨에서 규칙을 고정하면 개인 설정을 덮어쓴다.**

```
# .gitattributes
# 기본: 텍스트 파일 자동 감지 + LF로 정규화
*   text=auto

# 항상 LF (Unix 스크립트, 셸 스크립트)
*.sh    text eol=lf
*.bash  text eol=lf
Makefile text eol=lf
*.py    text eol=lf

# CRLF 강제 (Windows 전용)
*.bat   text eol=crlf
*.cmd   text eol=crlf
*.ps1   text eol=crlf

# 바이너리 (변환 없음)
*.png   binary
*.jpg   binary
*.zip   binary
```

`text=auto`는 Git이 파일 내용을 분석해 텍스트 여부를 자동 판단한다. 텍스트로 판단되면 커밋 시 LF로 정규화하고, 체크아웃 시 플랫폼 기본값으로 변환한다.

## 기존 저장소 정규화

이미 CRLF가 섞인 저장소를 일괄 정리한다.

```bash
# 1. .gitattributes 설정 후
cat > .gitattributes << 'EOF'
*   text=auto
*.sh text eol=lf
EOF

# 2. 모든 파일 재정규화
git add --renormalize .

# 3. 변경된 파일 확인
git status

# 4. 커밋
git commit -m "chore: normalize line endings"
```

`--renormalize`는 인덱스에 있는 파일을 현재 `.gitattributes` 규칙에 맞게 다시 스테이징한다.

## 현재 파일 줄 끝 확인

```bash
# 특정 파일의 줄 끝 확인 (16진수)
xxd src/script.sh | head -5
# \r\n 이 있으면 CRLF, \n만 있으면 LF

# file 명령으로 확인 (Linux/macOS)
file src/script.sh
# POSIX shell script, ASCII text  → LF
# POSIX shell script, ASCII text, with CRLF line terminators  → CRLF

# git ls-files --eol로 확인
git ls-files --eol | head -20
# i/lf w/crlf attr/text=auto  script.sh
# (i=저장소, w=워킹트리, attr=gitattributes 설정)
```

## core.safecrlf

실수로 CRLF가 저장소에 들어가는 것을 방지한다.

```bash
# CRLF가 저장소에 들어가면 경고
git config --global core.safecrlf true

# 경고만 (커밋은 허용)
git config --global core.safecrlf warn
```

---

**지난 글:** [Git에서 빈 디렉터리 유지하기](/posts/git-keep-empty-dir/)

**다음 글:** [Git 오브젝트 모델](/posts/git-object-model/)

<br>
읽어주셔서 감사합니다. 😊
