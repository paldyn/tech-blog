---
title: "런레벨과 systemd 타겟 — SysV에서 systemd로의 전환"
description: "SysV init의 런레벨 개념과 systemd 타겟의 대응 관계, isolate·get-default·set-default 명령으로 기본 타겟을 전환하는 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 6
type: "knowledge"
category: "Linux"
tags: ["Linux", "systemd", "런레벨", "target", "SysV", "부팅", "init"]
featured: false
draft: false
---

[지난 글](/posts/linux-dmesg-boot-logs/)에서 부팅 과정의 커널 로그를 읽는 법을 다뤘습니다. 커널이 초기화를 마치면 PID 1인 init 프로세스에게 제어를 넘기는데, 현대 Linux는 대부분 `systemd`가 그 역할을 합니다.

![SysV 런레벨 vs systemd 타겟](/assets/posts/linux-runlevels-vs-targets-compare.svg)

## SysV 런레벨이란

전통적인 SysV init 시스템은 시스템 상태를 **런레벨(runlevel)** 숫자로 표현했습니다. 런레벨이 바뀔 때 `/etc/rc?.d/` 디렉터리의 스크립트를 순차적으로 실행해 서비스를 시작하거나 중지했습니다.

```bash
# SysV 환경에서 런레벨 확인 (구버전)
runlevel
# N 5   (이전=없음, 현재=5)

# 런레벨 전환
telinit 3   # 텍스트 모드로 전환
```

## systemd 타겟

systemd는 런레벨 대신 **타겟(target)**을 사용합니다. 타겟은 `.target` 유닛 파일로 정의되며, 특정 시스템 상태에 도달하기 위해 필요한 의존성들을 선언합니다.

![systemd 타겟 의존 그래프](/assets/posts/linux-runlevels-vs-targets-deps.svg)

```bash
# 현재 기본 타겟 확인
systemctl get-default
# graphical.target

# 현재 활성화된 타겟들
systemctl list-units --type=target --state=active
```

## 타겟 전환

```bash
# 텍스트 모드로 전환 (재부팅 없이)
sudo systemctl isolate multi-user.target

# GUI 모드로 복귀
sudo systemctl isolate graphical.target

# 기본 타겟 영구 변경 (재부팅 후에도 유지)
sudo systemctl set-default multi-user.target
sudo systemctl set-default graphical.target
```

`isolate`는 지정한 타겟과 그 의존성만 남기고 나머지를 모두 중지합니다. GUI 없이 운영하는 서버에서 `multi-user.target`으로 설정하면 메모리를 절약할 수 있습니다.

## 타겟 상세 확인

```bash
# 타겟의 의존성 확인
systemctl cat graphical.target
# [Unit]
# Description=Graphical Interface
# Requires=multi-user.target
# Wants=display-manager.service
# ...

# 타겟이 요구하는 유닛 목록
systemctl list-dependencies graphical.target

# 타겟 달성 여부
systemctl is-active graphical.target
```

## 주요 타겟 설명

| 타겟 | 설명 |
|------|------|
| `poweroff.target` | 전원 차단 |
| `rescue.target` | 복구 모드 (네트워크 없는 root 쉘) |
| `emergency.target` | 최소 환경 (마운트도 안 된 상태) |
| `multi-user.target` | 네트워크 있는 텍스트 모드 |
| `graphical.target` | 완전한 GUI 부팅 (기본값) |
| `reboot.target` | 재부팅 |
| `sleep.target` | 절전 모드 |

## SysV 호환성

systemd는 SysV 런레벨 명령과의 호환성을 유지합니다.

```bash
# 아래 명령들은 systemd 환경에서도 동작
init 0       # poweroff.target
init 1       # rescue.target
init 3       # multi-user.target
init 5       # graphical.target
init 6       # reboot.target

# runlevel 심볼릭 링크 확인
ls -la /lib/systemd/system/runlevel*.target
# runlevel0.target -> poweroff.target
# runlevel3.target -> multi-user.target
# runlevel5.target -> graphical.target
```

## 런레벨 vs 타겟의 핵심 차이

SysV 런레벨은 순차적으로 스크립트를 실행했지만, systemd 타겟은 의존성 그래프를 분석해 **병렬로** 서비스를 시작합니다. 이것이 systemd가 부팅 속도를 대폭 개선한 핵심 이유입니다.

```bash
# 부팅 성능 분석
systemd-analyze blame | head -10

# 부팅 타임라인 그래프 생성
systemd-analyze plot > boot-timeline.svg
```

---

**지난 글:** [dmesg와 부트 로그 — 커널 링 버퍼 읽기](/posts/linux-dmesg-boot-logs/)

**다음 글:** [복구 모드와 emergency 타겟 — 부팅 실패 시 살아남기](/posts/linux-rescue-mode/)

<br>
읽어주셔서 감사합니다. 😊
