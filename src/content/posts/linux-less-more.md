---
title: "less & more: 대용량 파일을 페이지 단위로 읽기"
description: "less와 more로 대용량 텍스트 파일을 페이지 단위로 탐색하고, less의 고급 탐색·검색 키를 익혀 실무에 활용한다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 4
type: "knowledge"
category: "Linux"
tags: ["Linux", "less", "more", "페이저", "파일 읽기", "로그"]
featured: false
draft: false
---

[지난 글](/posts/linux-cat-tac-head-tail/)에서 `cat`, `tac`, `head`, `tail`로 파일 내용을 출력하는 방법을 배웠다. 이번 글에서는 **대용량 파일을 화면 한 페이지씩 넘기며 읽는 페이저(pager) 명령어**인 `less`와 `more`를 다룬다. 수천 줄짜리 로그 파일이나 매뉴얼 페이지를 다룰 때 없어서는 안 될 도구다.

## more — 가장 간단한 페이저

`more`는 Unix 초기부터 존재하던 페이저다. 파일 내용을 화면 한 페이지씩 출력하고, `Space`를 누르면 다음 페이지로 넘어간다.

```bash
more /var/log/syslog
more -d file.txt       # 하단에 도움말 표시
more +20 file.txt      # 20번째 줄부터 시작
```

`more`의 큰 단점은 **위로 스크롤이 불가능**하다는 점이다. 파일 끝에 도달하면 자동으로 종료된다. 이런 한계 때문에 현대적인 시스템에서는 `less`가 `more`를 대체한다.

## less — 더 강력한 페이저

`less`는 `more`의 기능을 모두 포함하면서 훨씬 많은 기능을 제공한다. **"less is more"**라는 이름답게, 이름이 less지만 more보다 기능이 훨씬 많다. `man` 명령도 내부적으로 `less`를 사용한다.

```bash
less file.txt
less -N file.txt           # 줄 번호 표시
less -S file.txt           # 긴 줄을 잘라서 표시 (가로 스크롤)
less -i file.txt           # 검색 시 대소문자 무시
less -R file.txt           # ANSI 색상 코드 렌더링
less +F /var/log/syslog    # tail -f 모드로 시작
less +/error file.txt      # 'error' 첫 발견 위치에서 시작
```

## less 핵심 키 조작

`less`를 열고 나면 vim과 유사한 키 체계로 파일을 탐색한다.

| 키 | 동작 |
|---|---|
| `Space` / `f` | 다음 페이지 |
| `b` | 이전 페이지 |
| `j` / `↓` | 한 줄 아래 |
| `k` / `↑` | 한 줄 위 |
| `g` | 파일 맨 처음 |
| `G` | 파일 맨 끝 |
| `50g` | 50번째 줄로 이동 |
| `50%` | 파일의 50% 위치로 이동 |
| `/패턴` | 아래 방향 검색 |
| `?패턴` | 위 방향 검색 |
| `n` / `N` | 다음/이전 검색 결과 |
| `F` | 실시간 추적 모드(tail -f와 동일) |
| `v` | `$EDITOR`로 현재 파일 열기 |
| `q` | 종료 |

![less 탐색 키 레퍼런스](/assets/posts/linux-less-more-navigation.svg)

## less의 검색 기능

`/패턴`을 입력하면 파일에서 정규 표현식으로 검색할 수 있다. 검색 결과는 하이라이트되며 `n`/`N`으로 다음/이전 결과로 빠르게 이동한다.

```bash
# less 안에서 검색 예시
/ERROR            # 'ERROR' 문자열 검색
/[0-9]{3}         # 세 자리 숫자 패턴 검색
?WARNING          # 위 방향으로 'WARNING' 검색
```

`-i` 옵션을 주면 대소문자를 무시하고 검색한다. `&패턴`을 입력하면 해당 패턴에 일치하는 줄만 보여주는 필터 모드가 된다.

## 여러 파일 탐색

`less`는 여러 파일을 인수로 받으면 한 세션에서 모두 탐색할 수 있다.

```bash
less file1.txt file2.txt file3.txt
```

안에서 `:n`(next)으로 다음 파일, `:p`(previous)로 이전 파일로 이동한다. `:f`를 누르면 현재 파일 이름과 위치 정보가 표시된다.

![less vs more 기능 비교](/assets/posts/linux-less-more-comparison.svg)

## 파이프라인에서 less 사용

`less`는 파이프에서도 자연스럽게 동작한다. 출력이 많은 명령의 결과를 `less`로 넘기면 페이지 단위로 편하게 볼 수 있다.

```bash
ps aux | less
grep -r "TODO" ./src | less
git log --oneline | less
dmesg | less
```

`$PAGER` 환경 변수에 `less`를 설정해 두면 `man`, `git log` 등 페이저를 사용하는 명령 모두에서 `less`가 사용된다.

```bash
export PAGER=less
export LESS='-RiN'    # -R: 색상, -i: 대소문자무시, -N: 줄번호
```

## LESSOPEN — 압축 파일 직접 보기

`less`는 `LESSOPEN` 환경 변수를 통해 전처리기를 연결할 수 있다. `lesspipe`를 설정하면 `.gz`, `.tar.gz`, `.zip` 등 압축 파일을 압축 해제 없이 바로 열어볼 수 있다.

```bash
eval "$(lesspipe)"    # ~/.bashrc 에 추가
less archive.tar.gz   # 압축 해제 없이 내용 목록 확인
less file.gz          # gzip 파일을 바로 열기
```

---

**지난 글:** [cat·tac·head·tail: 파일 내용 보기 4총사](/posts/linux-cat-tac-head-tail/)

**다음 글:** [cp·mv·rm: 파일 복사·이동·삭제 완전 정복](/posts/linux-cp-mv-rm/)

<br>
읽어주셔서 감사합니다. 😊
