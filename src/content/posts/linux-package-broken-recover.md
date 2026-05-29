---
title: "깨진 패키지 상태 복구"
description: "apt/dpkg가 중단되거나 의존성이 깨져 패키지 관리가 멈췄을 때, dpkg --configure -a, apt-get install -f, 강제 재설치로 패키지 데이터베이스를 정상으로 되돌리는 복구 절차를 단계별로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 1
type: "knowledge"
category: "Linux"
tags: ["linux", "apt", "dpkg", "troubleshooting", "recovery", "package"]
featured: false
draft: false
---

[지난 글](/posts/linux-corrupt-ssh-config/)에서 SSH 설정 파손으로 접속이 막혔을 때의 복구를 다뤘다. 이번에는 서버 운영 중 의외로 자주 마주치는 또 다른 막다른 길, 패키지 관리자가 깨진 상태를 다룬다. `apt upgrade` 도중 전원이 나가거나 디스크가 가득 차서 설치가 중단되면, 그 다음부터 어떤 `apt` 명령을 실행해도 "dpkg was interrupted" 또는 "unmet dependencies" 같은 에러만 반복되며 아무것도 진행되지 않는다. 패키지 데이터베이스가 어중간한 상태로 멈춰 있기 때문이다. 이 글에서는 그 상태를 진단하고 정상으로 되돌리는 절차를 살펴본다.

## 왜 패키지 상태가 깨지는가

데비안 계열에서 패키지 설치는 두 단계로 진행된다. 먼저 `.deb` 파일을 풀어서 파일을 제자리에 복사(unpack)하고, 그다음 설정 스크립트를 실행해 서비스 등록·설정 파일 생성 같은 마무리(configure)를 한다. 이 두 단계 사이에서 프로세스가 강제로 죽으면, dpkg는 "이 패키지는 풀렸지만 아직 설정되지 않았다"는 어정쩡한 상태로 기록을 남긴다.

이런 상태가 하나라도 있으면 dpkg는 안전을 위해 이후의 모든 작업을 거부한다. 흔한 원인은 다음과 같다.

- `apt upgrade` 중 SSH 세션이 끊기거나 전원이 나감
- `/` 또는 `/var` 파티션이 가득 차서 설치 스크립트가 파일을 쓰지 못함
- 패키지 자체의 설정 스크립트(postinst)에 버그가 있어 0이 아닌 종료 코드 반환
- 두 개의 apt 프로세스가 동시에 실행돼 lock 충돌

![깨진 패키지 복구 결정 흐름](/assets/posts/linux-package-broken-recover-flow.svg)

## 1단계: 중단된 설정 마무리하기

가장 먼저 시도할 명령은 `dpkg --configure -a`다. 이 명령은 "풀렸지만 설정되지 않은" 모든 패키지를 찾아 설정 단계를 다시 실행한다. 대부분의 중단 사고는 이 한 줄로 해결된다.

```bash
sudo dpkg --configure -a
```

설정 스크립트가 실패해서 멈췄던 경우라면, 이 명령이 같은 에러를 다시 보여줄 것이다. 그때는 출력에 나온 패키지 이름과 에러 메시지를 그대로 읽는 것이 중요하다. 예를 들어 "No space left on device"가 보이면 패키지 문제가 아니라 디스크 문제이므로, `df -h`로 용량을 확인하고 공간을 확보한 뒤 다시 시도해야 한다.

## 2단계: 깨진 의존성 복구하기

설정은 끝났지만 "unmet dependencies"가 남아 있을 수 있다. A 패키지를 설치하려는데 그것이 의존하는 B가 아직 안 깔린 상태로 멈춘 경우다. 이때는 `-f`(`--fix-broken`) 옵션이 핵심이다.

```bash
sudo apt-get install -f
```

이 명령은 현재 깨진 의존성 관계를 분석해서, 빠진 패키지를 설치하거나 충돌하는 패키지를 제거하는 계획을 제안한다. 실행하기 전에 apt가 무엇을 설치·제거하려는지 목록을 반드시 확인하자. 예상치 못한 패키지를 대량으로 제거하겠다고 하면, 잠시 멈추고 원인을 더 따져봐야 한다.

## 3단계: lock 충돌 풀기

다른 apt 프로세스(자동 업데이트인 `unattended-upgrades` 등)가 동시에 돌고 있으면 "Could not get lock /var/lib/dpkg/lock-frontend" 에러가 난다. 먼저 정상적으로 기다리거나 해당 프로세스를 확인한다.

```bash
# 누가 dpkg를 잡고 있는지 확인
sudo lsof /var/lib/dpkg/lock-frontend

# 백그라운드 자동 업데이트가 끝나길 기다린 뒤 재시도
ps aux | grep -E 'apt|dpkg' | grep -v grep
```

프로세스가 정말 죽어 있는데도 lock 파일만 남아 있는 게 확실할 때에 한해 lock 파일을 지운다. 살아 있는 프로세스가 있는데 lock을 지우면 데이터베이스가 더 심하게 손상될 수 있으니 주의한다.

```bash
sudo rm /var/lib/dpkg/lock*
sudo rm /var/cache/apt/archives/lock
sudo dpkg --configure -a
```

## 4단계: 특정 패키지 강제 복구

위 단계로도 특정 패키지 하나가 계속 발목을 잡는다면, 그 패키지만 강제로 정리하고 다시 설치한다. `--force-remove-reinstreq`는 "재설치가 필요한 상태로 표시된" 패키지를 강제로 제거하는 옵션이다.

```bash
sudo dpkg --remove --force-remove-reinstreq nginx
sudo apt-get install --reinstall nginx
```

![복구 명령 한눈에](/assets/posts/linux-package-broken-recover-commands.svg)

## RPM 계열에서는

페도라·RHEL 계열도 비슷한 문제를 겪는다. dnf/yum 트랜잭션이 깨졌을 때는 다음 명령으로 정리한다.

```bash
# 중단된 트랜잭션 마무리
sudo dnf history redo last

# RPM 데이터베이스 재구성 (손상 의심 시)
sudo rpm --rebuilddb

# 의존성 문제 자동 해결 시도
sudo dnf distro-sync
```

특히 `rpm --rebuilddb`는 RPM 데이터베이스 파일 자체가 손상됐을 때 인덱스를 다시 만들어 준다. 데이터베이스 손상은 보통 `/var/lib/rpm`이 있는 파티션이 가득 찼거나 비정상 종료된 뒤에 발생한다.

## 예방이 더 쉽다

복구보다 중요한 것은 같은 사고를 막는 일이다. 업그레이드 도중 세션이 끊겨도 작업이 이어지도록 `tmux`나 `screen` 안에서 패키지 작업을 실행하자. 또 업그레이드 전에 `df -h`로 `/`와 `/var`에 충분한 여유가 있는지 확인하는 습관을 들이면, 디스크 부족으로 인한 중단의 대부분을 피할 수 있다.

```bash
# 안전한 업그레이드 패턴
tmux new -s upgrade
df -h /          # 여유 공간 확인
sudo apt-get update
sudo apt-get upgrade
```

핵심은 패키지 관리자가 멈췄을 때 당황하지 않는 것이다. dpkg와 apt는 깨진 상태를 그대로 디스크에 기록해 두기 때문에, 거의 모든 경우 `dpkg --configure -a` → `apt-get install -f`의 두 단계로 원래 상태를 복원할 수 있다. 그래도 안 되는 특정 패키지만 강제 재설치로 떼어내면, 시스템 전체를 갈아엎지 않고도 정상으로 되돌릴 수 있다.

---

**지난 글:** [SSH 설정 파손 복구](/posts/linux-corrupt-ssh-config/)

**다음 글:** [systemd 서비스 실행 실패 진단](/posts/linux-systemd-service-fail/)

<br>
읽어주셔서 감사합니다. 😊
