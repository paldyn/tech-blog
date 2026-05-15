---
title: "pstree — 프로세스 부모-자식 트리 한눈에 보기"
description: "pstree로 systemd를 루트로 하는 프로세스 계층 구조를 시각화하는 방법, -p/-u/-c 옵션 활용, 특정 사용자 또는 PID 하위 트리만 보는 실전 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 3
type: "knowledge"
category: "Linux"
tags: ["linux", "pstree", "process", "tree", "hierarchy", "monitoring", "systemd"]
featured: false
draft: false
---

[지난 글](/posts/linux-ps-aux-ef/)에서 `ps aux`와 `ps -ef`로 프로세스 목록을 읽는 법을 다뤘습니다. `ps`가 평면 목록을 보여준다면, `pstree`는 프로세스들의 **부모-자식 계층 관계**를 트리 형태로 시각화합니다.

## pstree가 필요한 순간

어떤 프로세스가 누구의 자식인지, 어떤 부모 아래 자식들이 몇 개나 생겼는지, 특정 데몬이 어떤 워커를 얼마나 거느리는지 파악할 때 `ps` 평면 목록보다 `pstree`가 훨씬 직관적입니다. 특히 `nginx`, `gunicorn`, `php-fpm` 같은 멀티 워커 서버를 운영할 때 프로세스 구성을 빠르게 확인하는 데 유용합니다.

![프로세스 트리 구조 — systemd를 루트로 하는 계층](/assets/posts/linux-pstree-diagram.svg)

## 기본 사용법

```bash
# 시스템 전체 프로세스 트리
pstree

# PID 번호 함께 표시
pstree -p

# 사용자 이름 함께 표시
pstree -u

# PID + 사용자 + 컬러 (터미널에서 색 구분)
pstree -puc
```

기본 출력에서 동일한 이름의 프로세스가 여러 개면 `4*[worker]`처럼 묶어서 표시합니다. `-c` 옵션(compact 해제)을 주면 묶지 않고 펼쳐 출력합니다.

## 트리 구조 읽는 법

```
systemd(1)─┬─NetworkManager(812)─┬─dhclient(1023)
            │                    └─{NetworkManager}(813)
            ├─sshd(892)─┬─sshd(3001)
            │            └─sshd(3002)───bash(3010)───ps(3050)
            ├─nginx(1204)─┬─nginx(1205)
            │             └─nginx(1206)
            └─cron(1412)
```

- `─┬─` : 여러 자식 중 첫 번째 자식으로 분기
- `─└─` : 마지막 자식
- `{이름}` : 스레드 (중괄호)
- `n*[이름]` : 같은 이름 n개 묶음 (compact 표시)

## 주요 옵션

![pstree 주요 옵션과 출력 예시](/assets/posts/linux-pstree-code.svg)

### 특정 대상만 보기

```bash
# 특정 PID 하위 트리만
pstree -p 1204         # nginx 마스터 하위만

# 특정 사용자 프로세스만
pstree www-data
pstree -pu www-data    # PID + 사용자 표시

# 현재 셸 프로세스 하위 트리
pstree -p $$
```

### 현재 프로세스 하이라이트

```bash
# 현재 프로세스를 굵게(bold) 표시
pstree -H $$
```

터미널에서 실행하면 현재 셸까지의 경로가 굵은 글씨로 강조됩니다. 내가 어떤 계층 안에서 작업 중인지 파악할 때 유용합니다.

### 스레드 포함 출력

```bash
# 스레드(LWP)도 트리에 포함
pstree -t -p $$

# java 프로세스의 스레드 구조 확인
pstree -t -p $(pgrep -n java)
```

중괄호 `{name}`으로 표시되는 항목이 스레드입니다. 스레드가 많은 JVM이나 Node.js 프로세스 확인에 편리합니다.

## ps와 조합해 PPID 연쇄 추적

`pstree`는 직접적인 부모-자식 관계를 보여주지만, PPID를 재귀적으로 추적해 루트까지 경로를 출력하고 싶을 때는 다음 패턴이 유용합니다.

```bash
# 특정 PID의 조상 프로세스 체인 출력
pid=3050
while [ "$pid" != "0" ]; do
  ps -o pid=,ppid=,comm= -p "$pid"
  pid=$(ps -o ppid= -p "$pid" | tr -d ' ')
done
```

이 루프는 PID 3050에서 시작해 PID 1(systemd)까지 부모를 따라 올라가며 출력합니다.

## 설치 확인

`pstree`는 `psmisc` 패키지에 포함되어 있습니다.

```bash
# Debian/Ubuntu
sudo apt install psmisc

# RHEL/CentOS/AlmaLinux
sudo dnf install psmisc

# pstree 위치 확인
which pstree
```

---

**지난 글:** [ps 완전 가이드 — aux와 -ef로 프로세스 목록 읽기](/posts/linux-ps-aux-ef/)

**다음 글:** [top과 htop — 실시간 프로세스 모니터링](/posts/linux-top-htop/)

<br>
읽어주셔서 감사합니다. 😊
