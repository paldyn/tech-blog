---
title: "which · whereis · type: 명령어 위치 추적의 세 가지 방법"
description: "which, whereis, type의 동작 원리 차이를 이해하고, 상황별로 올바른 도구를 선택하는 방법을 익힌다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 1
type: "knowledge"
category: "Linux"
tags: ["Linux", "which", "whereis", "type", "명령어위치", "PATH"]
featured: false
draft: false
---

[지난 글](/posts/linux-locate-updatedb/)에서 `locate`로 파일시스템 전체를 순식간에 검색하는 방법을 살펴봤다. 이번에는 한 걸음 더 좁혀서 **"지금 내가 실행하는 이 명령어는 어디에 있는가?"** 를 추적하는 세 가지 도구, `which`, `whereis`, `type`을 비교한다. 세 명령어는 이름이 비슷하고 하는 일도 겹쳐 보이지만, 검색 범위와 반환 정보가 제각기 다르다. 차이를 모르면 당연히 알아야 할 것을 놓치거나, 쓸모없는 결과만 받게 된다.

## which — $PATH 안에서 실행 파일 위치 확인

`which`는 가장 단순한 도구다. 셸이 명령을 실행할 때 탐색하는 `$PATH` 디렉터리를 앞에서부터 순서대로 뒤져 **첫 번째로 발견한 실행 파일 경로**를 출력한다.

```bash
which python3          # /usr/bin/python3
which -a python3       # $PATH 내 모든 일치 경로 출력
echo $?                # 0 이면 발견, 1 이면 미발견
```

`-a` 옵션을 쓰면 `$PATH`에서 같은 이름의 실행 파일이 여러 군데 설치되어 있을 때 전부 보여준다. 가상환경(`venv`)과 시스템 Python이 동시에 있는 경우에 자주 사용된다.

`which`의 중요한 한계는 **쉘 빌트인(`cd`, `echo`, `alias` 등)과 함수를 인식하지 못한다**는 점이다. `which cd`를 실행하면 아무것도 출력되지 않거나 오류를 반환한다.

## whereis — 바이너리·소스·매뉴얼까지 한 번에

`whereis`는 `$PATH`가 아니라 `/usr/bin`, `/usr/sbin`, `/usr/share/man` 같은 **표준 시스템 경로**를 탐색한다. 실행 파일뿐 아니라 **소스 코드와 매뉴얼 페이지 위치까지** 함께 반환하는 것이 특징이다.

```bash
whereis nginx
# nginx: /usr/sbin/nginx /usr/share/man/man8/nginx.8.gz

whereis -b nginx       # 바이너리만
whereis -m nginx       # 매뉴얼만
whereis -s nginx       # 소스만
```

패키지를 설치한 뒤 "바이너리는 어디에, 문서는 어디에 있는가"를 한 번에 파악하고 싶을 때 `whereis`가 유용하다. 단, `$PATH`를 기준으로 동작하지 않기 때문에 사용자 홈 디렉터리나 `/opt` 아래에 수동으로 설치한 프로그램은 찾지 못할 수 있다.

![which · whereis · type 비교](/assets/posts/linux-which-whereis-type-overview.svg)

## type — 쉘이 명령을 어떻게 해석하는지 확인

`type`은 `which`, `whereis`와 근본적으로 다르다. 이것은 **외부 프로그램이 아니라 Bash 셸 빌트인**이다. 셸 자체가 명령을 실행하기 직전에 어떻게 해석하는지를 알려준다. 따라서 별칭(`alias`), 함수, 빌트인, 외부 실행 파일을 모두 구분할 수 있다.

```bash
type ls          # ls is aliased to 'ls --color=auto'
type cd          # cd is a shell builtin
type python3     # python3 is /usr/bin/python3
type -t ls       # alias
type -t cd       # builtin
type -t python3  # file
type -a python3  # 모든 일치 항목 출력
```

`-t` 옵션은 `alias`, `builtin`, `file`, `function`, `keyword` 중 하나를 출력한다. 스크립트에서 명령 유형에 따라 분기가 필요할 때 다음처럼 활용한다.

```bash
if [ "$(type -t mycommand)" = "function" ]; then
  echo "함수로 정의됨"
fi
```

## 실전 비교 예시

![실전 사용 예시](/assets/posts/linux-which-whereis-type-usage.svg)

## 세 도구 선택 기준

| 상황 | 추천 도구 |
|---|---|
| 스크립트에서 실행 경로를 변수에 저장 | `which` |
| 패키지의 바이너리·문서 위치 파악 | `whereis` |
| 명령이 alias인지 builtin인지 확인 | `type` |
| alias나 함수가 어떻게 정의됐는지 확인 | `type` |

`which`는 외부 프로그램이기 때문에 스크립트에서 경로를 캡처할 때는 `PYTHON=$(which python3)` 처럼 쓸 수 있다. 반면 `type`은 현재 셸 환경에 완전히 종속되므로 서브셸에서는 함수 정의가 보이지 않을 수 있다. 쉘 빌트인 여부까지 확인해야 할 때는 항상 `type`을 우선 쓰는 게 안전하다.

## command -v — 스크립트 이식성 높이기

POSIX 호환 스크립트에서는 `which` 대신 `command -v`를 쓰는 것이 관례다.

```bash
if command -v docker &>/dev/null; then
  echo "Docker 설치됨: $(command -v docker)"
else
  echo "Docker 없음"
fi
```

`command -v`는 `type`처럼 빌트인을 인식하면서도 출력 형식이 더 일관되어 `/bin/sh` 환경에서도 안전하게 동작한다.

---

**지난 글:** [locate & updatedb: 초고속 파일 위치 검색](/posts/linux-locate-updatedb/)

**다음 글:** [man · info · help: 리눅스 매뉴얼 완전 활용](/posts/linux-man-info-help/)

<br>
읽어주셔서 감사합니다. 😊
