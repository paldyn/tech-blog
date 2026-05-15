---
title: "man · info · help: 리눅스 매뉴얼 완전 활용"
description: "man 페이지 섹션 구조, info 하이퍼텍스트 문서, 쉘 빌트인 help 명령어를 이해하고 필요한 정보를 빠르게 찾는 방법을 익힌다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 2
type: "knowledge"
category: "Linux"
tags: ["Linux", "man", "info", "help", "매뉴얼", "문서"]
featured: false
draft: false
---

[지난 글](/posts/linux-which-whereis-type/)에서 명령어의 위치를 추적하는 방법을 배웠다. 이번에는 그 명령어가 **어떻게 동작하는지**를 알아내는 방법, 즉 리눅스 내장 문서 시스템을 파헤친다. 인터넷 검색 없이도 터미널 안에서 모든 매뉴얼을 읽을 수 있다. `man`, `info`, `help`는 형태도 다르고 커버하는 범위도 다르다. 세 도구를 모두 능숙하게 다루면 네트워크가 없는 환경에서도 두려움 없이 작업할 수 있다.

## man — 전통적인 유닉스 매뉴얼

`man`은 Unix 시절부터 내려온 매뉴얼 시스템이다. 내부적으로 `less` 페이저를 사용하므로 `less`와 동일한 키로 탐색한다.

```bash
man ls            # ls 매뉴얼 열기
man 5 passwd      # 섹션 5의 passwd (파일 형식)
man -k "copy"     # 키워드로 검색 (apropos 동일)
man -f stat       # 모든 섹션의 stat 항목 나열 (whatis 동일)
```

### man 페이지 내 탐색 키

| 키 | 동작 |
|---|---|
| `Space` / `b` | 다음/이전 페이지 |
| `/패턴` + `Enter` | 검색 |
| `n` / `N` | 다음/이전 검색 결과 |
| `g` / `G` | 처음/끝으로 이동 |
| `q` | 종료 |

### man 페이지 섹션 번호

같은 이름이라도 섹션에 따라 완전히 다른 내용을 담는다. `printf`는 섹션 1에서는 셸 명령어, 섹션 3에서는 C 라이브러리 함수다.

![man 페이지 섹션 번호](/assets/posts/linux-man-info-help-sections.svg)

### man 페이지 구조

매뉴얼 페이지는 고정된 섹션 순서로 구성된다.

```
NAME        — 이름과 한 줄 설명
SYNOPSIS    — 사용법 (대괄호: 선택, 밑줄: 필수)
DESCRIPTION — 상세 설명
OPTIONS     — 옵션 목록
EXAMPLES    — 사용 예
SEE ALSO    — 관련 항목
```

`SYNOPSIS`에서 `[OPTION]...`처럼 `...`이 붙으면 여러 번 반복 가능하다는 의미다.

## info — GNU 하이퍼텍스트 문서

GNU 프로젝트의 도구들(`bash`, `coreutils`, `gcc` 등)은 `man`보다 훨씬 방대한 정보를 `info` 형식으로 제공한다. 노드 기반 하이퍼텍스트 구조로 되어 있어 목차를 탐색하거나 링크를 따라 이동할 수 있다.

```bash
info coreutils    # GNU 핵심 유틸리티 전체 문서
info bash         # Bash 전체 레퍼런스
info '(coreutils) ls invocation'   # 특정 노드 직접 이동
```

### info 탐색 키

| 키 | 동작 |
|---|---|
| `n` / `p` | 다음/이전 노드 |
| `Tab` | 다음 링크로 커서 이동 |
| `Enter` | 링크 따라가기 |
| `u` | 상위 노드로 이동 |
| `l` | 이전 노드로 돌아가기 |
| `q` | 종료 |

`man ls`는 옵션 목록을 빠르게 훑기 좋지만, `info coreutils`는 각 옵션의 정확한 동작, 예외 케이스, 구현 세부사항까지 담고 있다. 깊게 이해하고 싶을 때는 `info`가 답이다.

## help — 쉘 빌트인 도움말

`cd`, `alias`, `export` 같은 Bash 빌트인 명령어는 별도 실행 파일이 없으므로 `man`에 항목이 없거나 있더라도 내용이 빈약하다. 이때는 Bash 내장 `help`를 쓴다.

```bash
help cd           # cd 빌트인 전체 도움말
help -d alias     # 한 줄 요약
help -s for       # 사용법(SYNOPSIS)만 출력
help              # 모든 빌트인 목록
```

외부 명령어에 대해서는 `--help` 플래그로 간단한 도움말을 얻을 수 있다.

```bash
ls --help
git --help
python3 --help
```

`--help`는 페이저 없이 터미널에 바로 출력하므로, 스크립트에서 옵션 목록을 `grep`으로 파이프할 때 편리하다.

```bash
ls --help | grep -i "sort"    # sort 관련 옵션만 필터
```

## 세 도구 비교 및 선택 기준

![man / info / help 도구 비교](/assets/posts/linux-man-info-help-navigation.svg)

## tldr — 실용적인 요약 도구

`man`이 너무 길다면 `tldr`을 고려해볼 수 있다. 커뮤니티가 작성한 짧은 예제 중심 요약을 제공한다.

```bash
sudo apt install tldr    # 설치
tldr tar                 # tar 자주 쓰는 예제만
tldr find                # find 주요 사용법 요약
```

`tldr`은 공식 문서를 대체하지 않는다. 빠른 참조에만 쓰고, 동작 방식을 정확히 이해해야 할 때는 반드시 `man`이나 `info`를 확인하라.

## 검색 전략 정리

```bash
# 이름을 알고 있으면
man command        # 첫 번째 선택
command --help     # 빠르게 옵션만

# 이름을 모르면
man -k "keyword"   # apropos 검색
info --apropos="keyword"

# 빌트인이면
help command

# 더 깊이 알고 싶으면
info command
```

---

**지난 글:** [which · whereis · type: 명령어 위치 추적의 세 가지 방법](/posts/linux-which-whereis-type/)

**다음 글:** [history & !bang: 셸 히스토리 완전 활용](/posts/linux-history-bang/)

<br>
읽어주셔서 감사합니다. 😊
