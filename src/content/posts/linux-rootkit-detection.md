---
title: "루트킷 탐지 — 숨은 침입자 찾기"
description: "루트킷의 작동 방식과 분류, rkhunter·chkrootkit·AIDE·Lynis를 활용한 탐지 방법, 라이브 CD 검사와 커널 레벨 루트킷 대응 전략을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 2
type: "knowledge"
category: "Linux"
tags: ["linux", "security", "rootkit", "rkhunter", "chkrootkit", "aide", "lynis", "intrusion-detection"]
featured: false
draft: false
---

[지난 글](/posts/linux-port-knocking/)에서 Port Knocking으로 포트 자체를 숨기는 방법을 살펴봤습니다. 이번에는 공격자가 이미 시스템에 침투한 경우를 대비해 **루트킷을 탐지하는 방법**을 다룹니다. 루트킷은 자신의 존재를 숨기도록 설계되어 있어 일반적인 보안 검사로는 잡기 어렵습니다.

## 루트킷이란

루트킷은 시스템에 침입한 뒤 흔적을 감추기 위해 OS 기능을 변조하는 악성 소프트웨어입니다. 이름처럼 **root 권한을 유지하면서 도구(kit)를 사용해 자신을 숨깁니다**. 크게 세 유형으로 나뉩니다.

| 유형 | 동작 | 예 |
|---|---|---|
| 유저스페이스 | ls, ps 같은 바이너리 교체 | Suckit, Knark |
| 커널 레벨(LKM) | 커널 모듈로 syscall 테이블 패치 | Adore-ng, Reptile |
| 부트킷 | MBR/UEFI 변조, OS 로드 전 실행 | Necurs, Rovnix |

커널 레벨 루트킷은 `ps`, `ls`, `netstat` 자체를 속이기 때문에 감염된 OS 안에서는 탐지가 매우 어렵습니다.

## 탐지 도구 비교

![루트킷 탐지 도구 비교 및 탐지 레이어](/assets/posts/linux-rootkit-detection-tools.svg)

## rkhunter 사용법

rkhunter는 가장 널리 사용되는 루트킷 탐지 도구입니다. 알려진 루트킷 시그니처 DB, 바이너리 해시 검사, 숨김 파일·포트 검사를 종합적으로 수행합니다.

![rkhunter · chkrootkit · AIDE 주요 명령](/assets/posts/linux-rootkit-detection-commands.svg)

```bash
# 설치
sudo apt install rkhunter

# 정상 상태 해시 DB 구축 (설치 직후 클린 시스템에서 실행)
sudo rkhunter --propupd

# 전체 검사
sudo rkhunter --check

# 경고만 출력 (자동화 로그에 적합)
sudo rkhunter --check --report-warnings-only --skip-keypress
```

검사 결과에서 `Warning` 항목을 중심으로 살펴봅니다. 일부 경고는 정상 시스템에서도 발생할 수 있으니 `/var/log/rkhunter.log`에서 맥락을 확인합니다.

```bash
# 로그 확인
sudo grep -E "Warning|Infected" /var/log/rkhunter.log
```

### 자동 실행 (cron)

```bash
# /etc/cron.d/rkhunter
0 3 * * * root /usr/bin/rkhunter --cronjob --report-warnings-only \
    --appendlog 2>&1 | mail -s "rkhunter report" admin@example.com
```

## chkrootkit 사용법

chkrootkit은 `ps` 출력과 `/proc` 디렉터리를 비교해 숨겨진 프로세스를 찾는 데 특화되어 있습니다.

```bash
sudo apt install chkrootkit

# 전체 검사
sudo chkrootkit

# LKM(로드 가능 커널 모듈) 루트킷만 검사
sudo chkrootkit lkm

# 상세 출력
sudo chkrootkit -v
```

`INFECTED` 문자열이 있는 줄을 집중적으로 확인합니다. `not found`는 해당 바이너리가 없다는 뜻이므로 무해합니다.

## AIDE — 파일 무결성 모니터링

AIDE(Advanced Intrusion Detection Environment)는 파일 해시 DB를 구축한 뒤 변경 사항을 추적합니다.

```bash
sudo apt install aide

# 초기 해시 DB 생성 (클린 시스템에서)
sudo aide --init
sudo mv /var/lib/aide/aide.db.new /var/lib/aide/aide.db

# 현재 시스템과 DB 비교
sudo aide --check

# DB 갱신 (의도적 변경 후)
sudo aide --update
sudo mv /var/lib/aide/aide.db.new /var/lib/aide/aide.db
```

중요한 원칙은 **DB를 별도 읽기 전용 미디어에 보관**하는 것입니다. 루트킷이 AIDE DB까지 변조할 수 있기 때문입니다.

## Lynis — 보안 감사

Lynis는 루트킷 탐지보다 **시스템 전반의 보안 감사**에 강점이 있습니다.

```bash
sudo apt install lynis

# 전체 감사 (root 필요)
sudo lynis audit system

# 결과 요약
sudo lynis audit system --quick
```

감사 후 `/var/log/lynis.log`에서 `Suggestion`과 `Warning` 항목을 확인합니다. Hardening Index 점수도 제공합니다.

## 커널 레벨 루트킷 대응

커널 레벨 루트킷에는 OS 안에서의 탐지가 신뢰할 수 없습니다. 다음 방법을 조합합니다.

**1. 라이브 CD/USB 부팅 후 검사**

감염 의심 시스템을 종료하고 Ubuntu Live USB 등으로 부팅해 마운트 후 검사합니다.

```bash
# 라이브 환경에서
sudo mount /dev/sda1 /mnt
sudo chroot /mnt
rkhunter --check
```

**2. lsmod 이상 확인**

```bash
# 알 수 없는 모듈 확인
lsmod | sort
# 이름이 없거나 /sys/module에 없는 모듈 주의
ls /sys/module/ | diff - <(lsmod | awk 'NR>1{print $1}' | sort)
```

**3. /proc와 ps 비교**

```bash
# /proc의 PID 목록
ls /proc | grep -E '^[0-9]+$' | sort -n > /tmp/proc_pids.txt
# ps의 PID 목록
ps -e --no-headers -o pid | sort -n > /tmp/ps_pids.txt
# 차이 확인 (proc에 있는데 ps에 없으면 숨겨진 프로세스)
diff /tmp/proc_pids.txt /tmp/ps_pids.txt
```

## 예방이 최우선

루트킷 탐지보다 중요한 것은 예방입니다.

- **정기 패치**: 커널, glibc, OpenSSL 취약점을 신속히 패치
- **최소 권한**: root 로그인 비활성화, sudo 제한
- **SELinux/AppArmor**: 커널 레벨 접근 제어로 루트킷 설치 경로 차단
- **Secure Boot**: 부트킷이 부팅 전에 로드되지 못하도록 차단

---

**지난 글:** [Port Knocking — 포트 숨겨두기로 공격 표면 줄이기](/posts/linux-port-knocking/)

**다음 글:** [auditd — 리눅스 감사 시스템](/posts/linux-auditd/)

<br>
읽어주셔서 감사합니다. 😊
