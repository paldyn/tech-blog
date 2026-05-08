---
title: "절대 경로 vs 상대 경로: Linux 파일 주소 완벽 이해"
description: "절대 경로와 상대 경로의 차이, 특수 기호(., .., ~, -)의 의미, 경로를 안전하게 다루는 모범 사례를 완전히 이해한다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 2
type: "knowledge"
category: "Linux"
tags: ["Linux", "경로", "절대경로", "상대경로", "cd", "파일시스템"]
featured: false
draft: false
---

[지난 글](/posts/linux-hidden-files/)에서 숨김 파일의 원리를 살펴봤다. 이번 글에서는 Linux에서 파일이나 디렉터리의 **위치를 표현하는 두 가지 방식인 절대 경로(absolute path)와 상대 경로(relative path)**를 체계적으로 정리한다. 두 개념을 혼용하거나 혼동하면 스크립트 오류나 의도치 않은 파일 접근이 발생할 수 있어 정확히 이해하는 것이 중요하다.

## 절대 경로

절대 경로는 **파일시스템의 루트(`/`)에서 출발해 대상까지의 전체 경로**를 나타낸다. 현재 작업 디렉터리(PWD)가 어디든 항상 같은 파일을 가리킨다.

```bash
/home/alice/docs/report.txt   # 절대 경로 예시
/etc/nginx/nginx.conf
/usr/local/bin/node
```

절대 경로는 항상 `/`로 시작한다. 이 `/`가 바로 리눅스 파일시스템의 최상위, 루트 디렉터리다.

## 상대 경로

상대 경로는 **현재 위치(PWD)를 기준으로 대상까지의 경로**를 나타낸다. PWD가 다르면 같은 문자열이라도 가리키는 대상이 달라진다.

```bash
# PWD = /home/alice 일 때
docs/report.txt           # /home/alice/docs/report.txt
../bob/notes.txt          # /home/bob/notes.txt
../../etc/hosts           # /etc/hosts
```

상대 경로는 `/`로 시작하지 않는다. `.`이나 `..`이나 파일/디렉터리 이름으로 바로 시작한다.

![절대 경로 vs 상대 경로 트리 다이어그램](/assets/posts/linux-paths-absolute-relative-diagram.svg)

## 특수 경로 기호

경로에서 자주 등장하는 네 가지 특수 기호를 알아두면 길고 복잡한 경로를 간결하게 표현할 수 있다.

| 기호 | 의미 | 예시 |
|---|---|---|
| `.` | 현재 디렉터리 | `./run.sh` → 현재 디렉터리의 run.sh |
| `..` | 상위 디렉터리 | `../../opt` → 두 단계 위의 opt |
| `~` | 현재 사용자 홈 (`$HOME`) | `~/.bashrc` → /home/alice/.bashrc |
| `-` | 직전 방문 디렉터리 (`$OLDPWD`) | `cd -` → 이전 위치로 복귀 |

![경로 특수 기호 정리](/assets/posts/linux-paths-absolute-relative-specials.svg)

## 경로 조작 명령

```bash
# 현재 경로 확인
pwd                     # 출력: /home/alice/projects

# 절대 경로로 이동
cd /var/log             # 어디서든 /var/log 로 이동

# 상대 경로로 이동
cd ../log               # 현재 위치의 상위에서 log 로 이동
cd ../../etc            # 두 단계 위에서 etc 로 이동

# 홈 디렉터리로
cd ~                    # $HOME 으로
cd                      # 인수 없이도 홈으로

# 이전 위치로 복귀
cd -                    # $OLDPWD 로 이동 후 경로 출력
```

## realpath와 경로 정규화

경로에 `..`이나 심볼릭 링크가 섞이면 실제 절대 경로가 무엇인지 헷갈릴 수 있다. `realpath`는 이를 정규화해 준다.

```bash
realpath docs/../notes/./plan.txt
# 출력: /home/alice/notes/plan.txt

realpath ~/../../etc/hosts
# 출력: /etc/hosts

# 심볼릭 링크 포함 물리 경로 확인
realpath -e /usr/bin/python3
```

`-e` 옵션은 경로가 실제로 존재하지 않으면 오류를 반환한다. 스크립트에서 경로 유효성 검증에 유용하다.

## 스크립트에서 경로 처리

스크립트를 작성할 때 상대 경로를 그대로 사용하면 스크립트가 어디서 실행되느냐에 따라 동작이 달라지는 버그가 생긴다. 스크립트 내부에서 파일 경로를 다룰 때는 스크립트 자신의 위치를 기준으로 절대 경로를 구성하는 패턴이 안전하다.

```bash
#!/bin/bash
# 스크립트 위치를 기준으로 경로를 구성하는 패턴
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/../config/settings.conf"
```

`dirname "$0"`은 스크립트 파일이 있는 디렉터리, `pwd`는 그 디렉터리의 절대 경로를 얻는다. 이 둘을 조합하면 스크립트가 어디서 실행되더라도 올바른 경로를 계산할 수 있다.

## 절대 경로와 상대 경로의 선택 기준

| 상황 | 권장 |
|---|---|
| 시스템 파일 접근 (`/etc`, `/var`) | 절대 경로 |
| 쉘 스크립트 내부 파일 참조 | `$SCRIPT_DIR` 기반 절대 경로 |
| 터미널 대화형 탐색 | 상대 경로 (빠르게 입력 가능) |
| cron, systemd 서비스 | 절대 경로 (실행 환경 불확실) |
| 프로젝트 내부 파일 참조 | 상대 경로 (이식성) |

일반적으로 **스크립트와 서비스 설정에서는 절대 경로**, **대화형 셸 사용에서는 상대 경로**가 더 편리하다.

---

**지난 글:** [숨김 파일 완전 이해: 점(.)으로 시작하는 파일의 비밀](/posts/linux-hidden-files/)

**다음 글:** [cat·tac·head·tail: 파일 내용 보기 4총사](/posts/linux-cat-tac-head-tail/)

<br>
읽어주셔서 감사합니다. 😊
