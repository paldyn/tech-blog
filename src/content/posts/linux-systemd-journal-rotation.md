---
title: "systemd 저널 로테이션과 보존 정책"
description: "journald.conf의 Storage, SystemMaxUse, MaxRetentionSec 등 핵심 설정으로 저널 크기를 제어하고, vacuum 명령으로 수동 정리하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 3
type: "knowledge"
category: "Linux"
tags: ["linux", "systemd", "journald", "journal", "rotation", "log", "vacuum", "journald.conf"]
featured: false
draft: false
---

[지난 글](/posts/linux-journalctl/)에서 journalctl로 로그를 조회하는 방법을 배웠습니다. 저널이 계속 쌓이면 디스크를 가득 채울 수 있습니다. systemd 저널은 자체 로테이션 메커니즘을 갖추고 있으며, `/etc/systemd/journald.conf`에서 세밀하게 제어할 수 있습니다.

## 저장 위치 결정 (Storage=)

저널이 어디에 기록될지는 `Storage=` 설정이 결정합니다.

| 값 | 경로 | 특징 |
|----|------|------|
| `persistent` | `/var/log/journal/` | 디스크, 재부팅 후에도 보존 |
| `volatile` | `/run/log/journal/` | RAM, 재부팅 시 사라짐 |
| `auto` | `/var/log/journal/` 존재하면 persistent, 없으면 volatile | 기본값 |
| `none` | 기록하지 않음 | syslog만 사용할 때 |

`auto`가 기본값이므로, 디스크에 저널을 영구 보존하려면 디렉터리를 직접 만들면 됩니다.

```bash
sudo mkdir -p /var/log/journal
sudo systemd-tmpfiles --create --prefix /var/log/journal
sudo systemctl restart systemd-journald
```

![journal 저장 위치와 파일 구조](/assets/posts/linux-systemd-journal-rotation-storage.svg)

## 크기 제한 설정

가장 중요한 설정 항목들입니다.

```ini
# /etc/systemd/journald.conf
[Journal]
Storage=persistent
SystemMaxUse=500M        # 전체 저널 최대 크기
SystemMaxFileSize=50M    # 개별 파일 최대 크기 (초과 시 새 파일 생성)
SystemKeepFree=1G        # FS에 반드시 남겨둘 여유 공간
MaxRetentionSec=4week    # 보존 기간 (0 = 무제한)
MaxFileSec=1month        # 파일 하나에 담을 최대 기간
Compress=yes             # 로그 압축 (기본 yes)
```

`SystemMaxUse`와 `SystemKeepFree` 중 더 엄격한 쪽이 실제 적용됩니다. 여유 공간이 `SystemKeepFree`보다 줄어들면 저널 크기가 `SystemMaxUse` 미만이어도 오래된 항목을 삭제합니다.

![journald.conf 주요 설정](/assets/posts/linux-systemd-journal-rotation-config.svg)

## 설정 적용

`journald.conf`를 수정하면 데몬을 재시작하거나 `USR2` 시그널로 설정을 다시 불러올 수 있습니다.

```bash
sudo systemctl restart systemd-journald   # 재시작 (짧은 로그 유실 없음)

# 또는 재시작 없이 설정만 리로드
sudo systemctl kill --signal=USR2 systemd-journald
```

적용 후 `journalctl --disk-usage`로 변화를 확인합니다.

## 수동 정리 (vacuum)

즉시 공간을 회수하려면 vacuum 명령을 씁니다.

```bash
# 크기 기준 정리
journalctl --vacuum-size=300M

# 기간 기준 정리
journalctl --vacuum-time=2weeks

# 파일 개수 기준 정리
journalctl --vacuum-files=5
```

세 옵션을 동시에 지정할 수도 있으며, 모두 충족하는 가장 엄격한 기준이 적용됩니다.

## 저널 파일 검증

저널 파일이 손상됐을 때 무결성을 검사할 수 있습니다.

```bash
journalctl --verify
```

오류가 발견되면 해당 파일을 삭제하고 저널 데몬을 재시작합니다. 일반적으로 비정상 종료 후 발생합니다.

## 사용자 저널

시스템 저널(`/var/log/journal/.../system.journal`) 외에 사용자별 저널(`user-UID.journal`)도 있습니다. 일반 사용자는 자신의 저널만 볼 수 있습니다.

```bash
journalctl --user                   # 현재 사용자 저널
journalctl --user -u myapp.service  # 사용자 서비스
```

사용자 저널 크기는 `RuntimeMaxUse`, `RuntimeMaxFileSize` 등 `Runtime*` 접두사 설정으로 제어합니다.

---

**지난 글:** [journalctl로 로그 읽기 — systemd 저널 완전 활용](/posts/linux-journalctl/)

**다음 글:** [systemd-resolved와 systemd-networkd](/posts/linux-systemd-resolved-networkd/)

<br>
읽어주셔서 감사합니다. 😊
