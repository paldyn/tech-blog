---
title: "sudo & sudoers — 권한 위임과 보안 설정"
description: "sudo의 동작 원리, /etc/sudoers 문법, sudoers.d 분리 관리, NOPASSWD·명령 제한 등 실무 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 2
type: "knowledge"
category: "Linux"
tags: ["linux", "sudo", "sudoers", "visudo", "privilege-escalation", "security", "linux-admin", "root"]
featured: false
draft: false
---

[지난 글](/posts/linux-groupadd-usermod/)에서 그룹 관리와 usermod를 살펴봤습니다. 이번에는 **sudo**를 다룹니다. `sudo`는 특정 사용자에게 root 권한을 부분적으로 위임하는 도구로, 올바르게 설정하면 보안성과 편의성을 동시에 확보할 수 있습니다.

## sudo가 필요한 이유

root로 항상 작업하는 것은 위험합니다. 오타 하나로 시스템 전체를 망가뜨릴 수 있고, 어떤 명령이 root로 실행됐는지 추적하기 어렵습니다. `sudo`는 두 문제를 모두 해결합니다.

- 필요한 명령만 root 권한으로 실행하고, 나머지는 일반 사용자 권한 유지
- 실행 내역이 `/var/log/auth.log` 또는 `journalctl`에 기록됨

## sudo 기본 사용

```bash
# 단일 명령을 root로 실행
sudo apt update

# 특정 사용자로 실행
sudo -u www-data ls /var/www

# root 셸 열기
sudo -i       # root의 환경변수 로드
sudo -s       # 현재 환경 유지, root 셸

# 캐시 초기화 (즉시 비밀번호 재요구)
sudo -k
```

`sudo -i` 는 root의 `~/.bashrc`와 `~/.profile`을 읽어 환경을 완전히 전환합니다. `sudo -s` 는 현재 사용자의 환경을 유지한 채로 root 셸을 엽니다.

## /etc/sudoers 문법

![sudoers 파일 문법](/assets/posts/linux-sudo-sudoers-syntax.svg)

sudoers 파일의 핵심 라인 구조는 다음과 같습니다.

```
사용자  호스트=(실행사용자:실행그룹)  [태그:]  명령어
```

```bash
# 모든 명령 허용 (관리자)
alice   ALL=(ALL:ALL) ALL

# 그룹 단위 (% 접두사)
%sudo   ALL=(ALL:ALL) ALL

# 비밀번호 없이 특정 명령만
bob     ALL=(root) NOPASSWD: /usr/bin/systemctl restart nginx

# 여러 명령 콤마 구분
charlie ALL=(ALL) /usr/bin/apt update, /usr/bin/apt upgrade
```

**그룹 지정**: `%groupname` 형태. `%sudo`, `%wheel`, `%devops` 등을 사용하면 개인 계정을 직접 나열하지 않아도 됩니다.

## visudo — 반드시 visudo로 편집

```bash
sudo visudo                          # 기본 편집기로 /etc/sudoers 열기
sudo visudo -f /etc/sudoers.d/bob    # 특정 파일 편집
EDITOR=nano sudo visudo              # 편집기 선택
```

`visudo`는 저장 시 문법을 검사합니다. 문법 오류가 있으면 저장을 거부하거나 재편집을 요청합니다. **직접 `nano /etc/sudoers`로 편집하면 문법 오류가 그대로 저장되어 sudo 전체가 잠길 수 있습니다.**

## sudoers.d — 분리 파일로 관리

`/etc/sudoers.d/` 디렉터리의 파일들이 자동으로 포함됩니다. 팀별, 서비스별로 권한을 분리 관리하기 좋습니다.

```bash
# 파일 생성 (visudo로)
sudo visudo -f /etc/sudoers.d/devops

# 파일 내용 예시
%devops ALL=(ALL) NOPASSWD: /usr/bin/kubectl, /usr/bin/helm

# 파일 권한 확인 (440이어야 함)
ls -la /etc/sudoers.d/
```

파일명에 `.` 이나 `~` 가 포함되면 무시됩니다. `00-admins`, `10-devops` 처럼 숫자 접두사로 적용 순서를 명시하는 것이 관례입니다.

## sudo 실행 흐름과 로깅

![sudo 실행 흐름](/assets/posts/linux-sudo-sudoers-flow.svg)

sudo는 실행할 때마다 다음을 기록합니다.

```bash
# journalctl로 sudo 사용 내역 확인
sudo journalctl -g "sudo" --since "1 hour ago"

# /var/log/auth.log (Debian/Ubuntu)
grep sudo /var/log/auth.log | tail -20
```

실패한 sudo 시도(권한 없는 사용자가 sudo 사용)도 기록되므로, 보안 감사에 활용할 수 있습니다.

## 보안 강화 설정

```bash
# /etc/sudoers 또는 /etc/sudoers.d/security

# 캐시 시간을 0으로 (매번 비밀번호 요구)
Defaults timestamp_timeout=0

# 특정 환경변수만 전달
Defaults env_keep += "http_proxy https_proxy"

# sudo 사용 시 tty 강제 (SSH 에이전트 탈취 방지)
Defaults requiretty

# 나쁜 패턴: 와일드카드로 우회 가능
bob ALL=(root) /usr/bin/vim /var/log/*   # vim 내 :!bash 로 우회 가능
```

명령어에 와일드카드 `*`를 쓰면 인수 치환으로 권한 우회가 가능합니다. 특정 명령만 허용할 때는 절대 경로와 고정 인수를 함께 명시하세요.

## 현재 권한 확인

```bash
# 내 sudo 권한 목록
sudo -l

# 다른 사용자의 권한 (root 필요)
sudo -l -U bob

# sudo 없이 실행 가능한지 미리 확인 (실제 실행 안 함)
sudo -n apt update && echo "가능" || echo "비밀번호 필요 또는 권한 없음"
```

`-n` 옵션은 비밀번호를 묻지 않고 바로 실패하므로, 스크립트에서 NOPASSWD 설정 여부를 확인할 때 유용합니다.

---

**지난 글:** [groupadd & usermod — 그룹 관리와 사용자 속성 변경](/posts/linux-groupadd-usermod/)

**다음 글:** [su vs sudo — 사용자 전환의 두 가지 방법](/posts/linux-su-vs-sudo/)

<br>
읽어주셔서 감사합니다. 😊
