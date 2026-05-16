---
title: "systemd 타겟 — 런레벨의 현대적 대체"
description: "systemd 타겟의 계층 구조, SysV 런레벨과의 대응 관계, 기본 타겟 설정, 복구 모드 진입 방법, 커스텀 타겟 생성을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 10
type: "knowledge"
category: "Linux"
tags: ["linux", "systemd", "target", "runlevel", "multi-user", "graphical", "rescue", "emergency", "boot"]
featured: false
draft: false
---

[지난 글](/posts/linux-systemd-unit-files/)에서 유닛 파일을 작성하는 방법을 배웠습니다. 이번에는 **타겟(target)**을 다룹니다. 타겟은 SysV init의 런레벨을 대체하는 개념으로, 여러 유닛을 그룹화해 시스템의 특정 상태를 정의합니다.

## 타겟이란

`.target` 유닛은 다른 유닛들의 **동기화 포인트**입니다. 서비스나 마운트처럼 실제 무언가를 실행하는 것이 아니라, "이 타겟에 도달했을 때 이런 서비스들이 실행 중이어야 한다"는 상태를 정의합니다.

```bash
# 현재 활성 타겟 보기
systemctl list-units --type=target

# 특정 타겟의 의존성 확인
systemctl list-dependencies multi-user.target
```

## 주요 타겟과 계층 구조

![systemd 타겟 계층](/assets/posts/linux-systemd-targets-hierarchy.svg)

부팅 시 기본적으로 다음 체인을 거칩니다.

```
sysinit.target → basic.target → multi-user.target
                                      ↓
                               graphical.target (GUI 환경이면)
```

각 타겟에 도달하면 해당 타겟을 `WantedBy=`로 지정한 서비스들이 시작됩니다.

## SysV 런레벨과 대응

| SysV 런레벨 | systemd 타겟 | 설명 |
|-------------|-------------|------|
| 0 | `poweroff.target` | 전원 끄기 |
| 1 | `rescue.target` | 단일 사용자 복구 |
| 3 | `multi-user.target` | 텍스트 다중 사용자 |
| 5 | `graphical.target` | GUI |
| 6 | `reboot.target` | 재부팅 |

`runlevel3.target`은 `multi-user.target`의 심볼릭 링크입니다. 하위 호환성을 위해 존재하며, 내부적으로 동일합니다.

## 기본 타겟 설정

```bash
# 현재 기본 타겟 확인
systemctl get-default

# GUI → 텍스트 모드 (서버에서 GUI 제거 시)
sudo systemctl set-default multi-user.target

# 텍스트 → GUI
sudo systemctl set-default graphical.target
```

`set-default`는 `/etc/systemd/system/default.target` 심볼릭 링크를 변경합니다. 다음 부팅부터 적용되고, 현재 실행 중인 시스템에는 영향 없습니다.

## 즉시 타겟 전환 — isolate

```bash
# 현재 세션을 텍스트 모드로 전환 (GUI 종료)
sudo systemctl isolate multi-user.target

# 복구 모드로 즉시 전환
sudo systemctl isolate rescue.target
```

`isolate`는 지정한 타겟이 필요로 하지 않는 유닛을 모두 중지하고, 타겟이 요구하는 유닛을 시작합니다. `AllowIsolate=yes`가 있는 타겟만 이 방식으로 전환 가능합니다.

## 복구 타겟

![타겟 관련 명령어](/assets/posts/linux-systemd-targets-commands.svg)

**rescue.target:** 단일 사용자 모드. root 비밀번호가 필요하고, 네트워크 없이 기본 파일시스템만 마운트됩니다. 비밀번호 리셋, 서비스 문제 진단에 사용합니다.

**emergency.target:** 더 최소화된 환경. 루트 파일시스템만 읽기 전용으로 마운트됩니다. 파일시스템이 손상되어 복구가 필요할 때 진입합니다.

```bash
# GRUB에서 복구 모드 진입
# 부팅 시 e키 → linux 줄 끝에 추가:
systemd.unit=rescue.target
# 또는
systemd.unit=emergency.target

# emergency.target에서 파일시스템 쓰기 가능하게
mount -o remount,rw /
```

## 커스텀 타겟 만들기

특정 개발 환경이나 운영 모드를 타겟으로 정의하면 일관되게 서비스 조합을 제어할 수 있습니다.

```bash
# 1. 타겟 파일 생성
sudo tee /etc/systemd/system/dev.target << 'EOF'
[Unit]
Description=Development Environment Target
Requires=multi-user.target
After=multi-user.target
AllowIsolate=yes

[Install]
WantedBy=multi-user.target
EOF

# 2. 개발 서비스를 이 타겟에 연결
sudo mkdir -p /etc/systemd/system/dev.target.wants/
sudo ln -s /lib/systemd/system/postgresql.service \
           /etc/systemd/system/dev.target.wants/

# 3. 활성화
sudo systemctl daemon-reload
sudo systemctl isolate dev.target
```

## 의존성 그래프 시각화

```bash
# 특정 타겟의 의존성 트리
systemctl list-dependencies graphical.target

# 특정 서비스가 어느 타겟에 속하는지
systemctl list-dependencies --reverse nginx.service

# SVG로 전체 의존성 그래프 생성
systemd-analyze dot | dot -Tsvg > /tmp/deps.svg
```

`systemd-analyze dot`은 Graphviz가 필요합니다. 수백 개 유닛을 포함하는 그래프가 생성되므로, 특정 서비스로 필터링하는 것이 실용적입니다.

```bash
# nginx 관련 의존성만
systemd-analyze dot nginx.service | dot -Tsvg > nginx-deps.svg
```

---

**지난 글:** [systemd 유닛 파일 — 서비스 정의의 모든 것](/posts/linux-systemd-unit-files/)

**다음 글:** [systemd 타이머 vs cron — 주기적 작업 스케줄링](/posts/linux-systemd-timers-vs-cron/)

<br>
읽어주셔서 감사합니다. 😊
