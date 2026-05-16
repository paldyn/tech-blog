---
title: "su vs sudo — 사용자 전환의 두 가지 방법"
description: "su와 sudo의 동작 원리, 환경 차이, 보안 모델을 비교하고 현대 Linux 환경에서 올바른 사용법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 3
type: "knowledge"
category: "Linux"
tags: ["linux", "su", "sudo", "root", "user-switch", "privilege", "security", "linux-admin"]
featured: false
draft: false
---

[지난 글](/posts/linux-sudo-sudoers/)에서 sudo와 sudoers 설정을 살펴봤습니다. 이번에는 **su**와 **sudo**를 직접 비교하면서, 어떤 상황에 어떤 명령을 써야 하는지 명확히 합니다.

## su — Substitute User

`su`는 현재 터미널 세션에서 다른 사용자로 **완전히 전환**합니다. 대상 사용자의 비밀번호를 알아야 사용할 수 있습니다.

```bash
# root로 전환 (환경변수 일부 유지)
su

# root 환경 완전히 로드 (권장)
su -

# bob으로 전환
su - bob

# 명령 실행 후 복귀
su -c "whoami" root
```

`su`와 `su -`의 차이가 중요합니다. 하이픈 없이 실행하면 HOME은 바뀌지만 PATH 등 환경변수는 이전 사용자 것을 그대로 씁니다. `/sbin`, `/usr/sbin` 같은 관리자 경로가 PATH에 없어 명령을 찾지 못하는 상황이 생길 수 있습니다.

![su 명령어 사용법](/assets/posts/linux-su-vs-sudo-commands.svg)

## sudo — 선택적 권한 위임

`sudo`는 사용자 전환 없이, 특정 명령을 다른 사용자(주로 root) 권한으로 실행합니다. 자신의 비밀번호를 사용하며, 허용된 명령은 `/etc/sudoers`가 제어합니다.

```bash
# 단일 명령
sudo apt update

# root 셸 (su - 와 유사)
sudo -i

# root 셸 (현재 환경 유지)
sudo -s

# 다른 사용자로 명령 실행
sudo -u www-data cat /var/www/secret.txt
```

`sudo -i`는 root의 `.profile`과 `.bashrc`를 불러와 완전한 root 환경을 제공합니다. `su -`와 비슷하지만 root 비밀번호가 필요 없습니다.

## su vs sudo 비교

![su vs sudo 비교](/assets/posts/linux-su-vs-sudo-compare.svg)

두 명령의 핵심 차이는 **인증 방식**과 **감사 가능성**입니다.

| 항목 | su | sudo |
|------|-----|------|
| 인증 | 대상 계정 비밀번호 | 자신의 비밀번호 |
| 로그 | 전환 사실만 | 실행 명령 전체 |
| 범위 | 전체 환경 전환 | 허용 명령만 |
| root 비밀번호 | 필요 | 불필요 |

`su`로 root에 접속하면 이후 모든 명령은 root로 실행되지만, 어떤 명령을 실행했는지 기록이 없습니다. `sudo`는 명령 하나하나가 로그에 남습니다.

## Ubuntu에서 su가 안 되는 이유

Ubuntu는 기본적으로 **root 계정을 잠가 두고** 비밀번호를 설정하지 않습니다. `su -` 를 실행하면 비밀번호를 요구하지만 맞는 비밀번호가 없습니다.

```bash
# Ubuntu에서 root 접속
sudo -i          # 권장: sudo로 root 셸
sudo su -        # 가능하지만 불필요한 이중 래핑

# root 비밀번호를 직접 설정하고 싶다면 (비권장)
sudo passwd root
```

Ubuntu의 철학은 "root 비밀번호를 아무도 모르게 한다"는 것입니다. root가 필요한 모든 작업은 `sudo`를 거치게 해 감사 추적을 강제합니다.

## runuser — 데몬·스크립트용

```bash
# root가 다른 사용자로 명령 실행 (비밀번호 불필요)
runuser -l www-data -c "php artisan schedule:run"
```

`runuser`는 `su`와 비슷하지만 PAM 인증을 거치지 않습니다. 이미 root인 스크립트에서 권한을 낮춰 명령을 실행할 때 사용합니다. systemd 서비스 파일의 `User=` 지시어가 내부적으로 이 방식을 사용합니다.

## 실무 권장 패턴

```bash
# ✓ 권장: sudo로 단일 명령
sudo systemctl restart nginx

# ✓ 권장: 긴 작업은 sudo -i로 root 셸 진입
sudo -i
# ... 여러 작업 ...
exit

# ✗ 비권장: su를 통한 root 접속 (팀 서버에서 특히)
su -     # 누가 무엇을 했는지 추적 불가
```

개인 개발 서버라면 `su -` 가 간편할 수 있습니다. 하지만 팀이 공유하는 서버라면 개인 계정에 sudo 권한을 부여하고, `su -`는 사용하지 않는 것이 감사 추적과 보안 사고 대응에 훨씬 유리합니다.

---

**지난 글:** [sudo & sudoers — 권한 위임과 보안 설정](/posts/linux-sudo-sudoers/)

**다음 글:** [id, whoami, w, who — 현재 사용자 확인 명령어](/posts/linux-id-whoami-w-who/)

<br>
읽어주셔서 감사합니다. 😊
