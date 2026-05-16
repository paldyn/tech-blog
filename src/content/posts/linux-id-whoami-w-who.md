---
title: "id, whoami, w, who — 현재 사용자 확인 명령어"
description: "id로 UID·GID·그룹을 확인하고, whoami·logname의 차이, w·who로 로그인 세션 현황을 파악하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 4
type: "knowledge"
category: "Linux"
tags: ["linux", "id", "whoami", "w", "who", "logname", "uid", "gid", "session", "user-management"]
featured: false
draft: false
---

[지난 글](/posts/linux-su-vs-sudo/)에서 su와 sudo의 차이를 살펴봤습니다. 이번에는 **현재 내가 누구인지**, **서버에 누가 접속해 있는지**를 확인하는 명령어를 다룹니다. 간단해 보이지만 sudo, su, 서비스 계정 전환이 얽힌 상황에서는 예상과 다른 결과가 나올 수 있습니다.

## id — 신원 정보 전체 보기

`id`는 현재 사용자(또는 지정한 사용자)의 UID, 기본 GID, 보조 그룹 목록을 한 줄로 보여줍니다.

```bash
# 현재 사용자
id

# 특정 사용자
id alice

# 숫자만 출력 (스크립트용)
id -u          # UID
id -g          # 기본 GID
id -G          # 모든 GID 공백 구분
```

![id 명령 출력 분석](/assets/posts/linux-id-whoami-w-who-id.svg)

스크립트에서 root 여부를 확인하는 패턴은 다음과 같습니다.

```bash
if [ "$(id -u)" -ne 0 ]; then
  echo "root로 실행하세요" >&2
  exit 1
fi
```

`id -u`가 `0`이면 root입니다. `$EUID` 환경변수도 같은 값을 담고 있어 `[ "$EUID" -ne 0 ]` 으로도 쓸 수 있습니다.

## whoami vs logname — 미묘한 차이

두 명령 모두 사용자 이름을 반환하지만, sudo 환경에서 결과가 달라집니다.

```bash
# 일반 상황: 동일 결과
whoami      # alice
logname     # alice

# sudo 내부
sudo whoami      # root  (유효 사용자)
sudo logname     # alice (로그인 사용자)
```

`whoami`는 **유효 사용자(effective user)** 이름을 반환합니다. `sudo` 실행 중에는 root가 됩니다. `logname`은 **로그인 세션의 원래 사용자** 이름을 반환합니다. 스크립트에서 "sudo를 실행한 실제 사람"을 추적할 때 `logname`이 유용합니다.

## who — 로그인 세션 목록

`who`는 현재 로그인된 세션 목록을 보여줍니다. `/run/utmp` 파일을 읽습니다.

```bash
who             # 세션 목록
who -q          # 이름과 인원수만
who -b          # 마지막 부팅 시간
who am i        # 내 세션 정보만 (= who am i)
```

출력 형식: `사용자명 터미널 로그인시간 (접속IP)`

```
alice pts/0  2026-05-17 09:15 (192.168.1.100)
bob   pts/1  2026-05-17 08:30 (10.0.0.5)
```

`pts/N`은 가상 터미널(원격 SSH 등), `tty1~tty6`은 로컬 콘솔을 의미합니다.

## w — 세션과 활동 통합 보기

`w`는 `who`에 각 세션의 CPU 사용량과 현재 실행 중인 명령을 더한 정보를 제공합니다.

![w, who, whoami 명령](/assets/posts/linux-id-whoami-w-who-w.svg)

```bash
w              # 전체 정보
w alice        # 특정 사용자만
w -h           # 헤더 생략
```

첫 줄의 load average는 `uptime` 명령과 동일한 값입니다. IDLE 컬럼이 길면 해당 사용자의 세션이 오래 유휴 상태임을 알 수 있습니다.

## last — 최근 로그인 기록

`who`가 현재 세션을 보여준다면, `last`는 과거 기록을 봅니다.

```bash
# 최근 로그인 목록
last

# 특정 사용자
last alice

# 마지막 로그인 실패 기록
sudo lastb

# 최근 5개만
last -5
```

`last`는 `/var/log/wtmp`를 읽습니다. 이 파일은 `lastb`(`/var/log/btmp`)와 함께 로그인 감사에 사용됩니다.

## users — 간단한 사용자 목록

```bash
# 현재 로그인한 사용자 이름만 (공백 구분)
users
# alice bob alice   ← 중복은 여러 세션
```

`users`는 `/run/utmp`를 읽어 이름만 출력합니다. 사람 수를 세는 스크립트에서 `users | wc -w` 패턴으로 사용합니다.

## 실전: 서버 점검 체크리스트

```bash
# 누가 접속해 있고 무엇을 하는지
w

# 최근 root 로그인 확인
last root | head -10

# 로그인 실패 시도 확인
sudo lastb | head -20

# 내 그룹 확인 (권한 문제 디버깅)
id
```

서비스 점검이나 배포 전에 다른 사용자가 같은 파일을 수정 중인지 `w`로 먼저 확인하는 것이 좋은 습관입니다.

---

**지난 글:** [su vs sudo — 사용자 전환의 두 가지 방법](/posts/linux-su-vs-sudo/)

**다음 글:** [getent — 사용자·그룹 데이터베이스 조회](/posts/linux-getent-passwd-group/)

<br>
읽어주셔서 감사합니다. 😊
