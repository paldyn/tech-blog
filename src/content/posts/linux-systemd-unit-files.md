---
title: "systemd 유닛 파일 — 서비스 정의의 모든 것"
description: "[Unit], [Service], [Install] 세 섹션의 구조, 의존성 지시어(After/Requires/Wants), Type과 Restart 옵션, override.conf 활용법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 9
type: "knowledge"
category: "Linux"
tags: ["linux", "systemd", "unit-file", "service-unit", "after", "requires", "restart", "execstart", "linux-admin"]
featured: false
draft: false
---

[지난 글](/posts/linux-systemctl-basics/)에서 systemctl로 서비스를 제어하는 방법을 배웠습니다. 이번에는 서비스를 **정의하는** 유닛 파일을 직접 작성하고 수정하는 방법을 다룹니다. 자신만의 서비스를 systemd로 관리하거나 기존 서비스 설정을 튜닝할 때 유닛 파일을 이해하는 것이 필수입니다.

## 유닛 파일의 세 섹션

유닛 파일은 INI 형식으로 세 섹션으로 나뉩니다.

![유닛 파일 구조](/assets/posts/linux-systemd-unit-files-structure.svg)

```ini
[Unit]       # 서비스 설명과 의존성
[Service]    # 실행 방법과 재시작 정책
[Install]    # enable 시 연결할 타겟
```

## [Unit] 섹션 — 의존성 제어

```ini
[Unit]
Description=My Application Service
After=network.target postgresql.service
Requires=postgresql.service
Wants=redis.service
```

**의존성 지시어 비교:**

| 지시어 | 의미 |
|--------|------|
| `After=` | 순서만 지정 (저것이 먼저 시작된 후) |
| `Requires=` | 강한 의존성 (저것이 실패하면 나도 중단) |
| `Wants=` | 약한 의존성 (저것이 없어도 나는 계속) |
| `BindsTo=` | Requires보다 강함 (저것이 중단되면 나도 즉시 중단) |

`After=`는 시작 순서만 제어하고, 의존성 자체는 `Requires=`나 `Wants=`로 별도 설정해야 합니다. 둘을 함께 쓰는 경우가 많습니다.

## [Service] 섹션 — 실행 설정

```ini
[Service]
Type=simple
User=appuser
Group=appgroup
WorkingDirectory=/opt/myapp
EnvironmentFile=/etc/myapp/env
ExecStartPre=/opt/myapp/check-config.sh
ExecStart=/opt/myapp/bin/server --port 8080
ExecReload=/bin/kill -HUP $MAINPID
Restart=on-failure
RestartSec=5
```

**ExecStart 주의사항:**

```ini
# ✓ 절대 경로 필수
ExecStart=/usr/bin/node /opt/app/server.js

# ✓ 환경변수는 EnvironmentFile 로
EnvironmentFile=/etc/myapp/.env
ExecStart=/usr/bin/python3 /opt/app/main.py

# ✗ 쉘 기능(파이프, &&)은 직접 사용 불가
ExecStart=/bin/foo | /bin/bar   # 오류

# ✓ 쉘 기능이 필요하면
ExecStart=/bin/bash -c "/bin/foo | /bin/bar"
```

![서비스 Type과 Restart 옵션](/assets/posts/linux-systemd-unit-files-types.svg)

## [Install] 섹션 — 활성화 설정

```ini
[Install]
WantedBy=multi-user.target
```

`systemctl enable`이 실행하면 `/etc/systemd/system/multi-user.target.wants/myapp.service` 심볼릭 링크를 만듭니다. 이 링크가 있으면 `multi-user.target`이 활성화될 때 이 서비스도 함께 시작합니다.

## 실전: 나만의 서비스 만들기

```bash
# 1. 유닛 파일 작성
sudo nano /etc/systemd/system/myapp.service
```

```ini
[Unit]
Description=My Python App
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/myapp
EnvironmentFile=/opt/myapp/.env
ExecStart=/usr/bin/python3 server.py
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
# 2. systemd에 알리기
sudo systemctl daemon-reload

# 3. 활성화 및 시작
sudo systemctl enable --now myapp

# 4. 확인
systemctl status myapp
```

## override.conf — 원본 파일 수정 없이 덮어쓰기

패키지가 제공한 유닛 파일을 직접 수정하면 패키지 업데이트 시 덮어씌워집니다. `systemctl edit`으로 override.conf를 만들면 원본은 유지됩니다.

```bash
# override.conf 편집기 열기
sudo systemctl edit nginx

# 에디터에 입력
[Service]
LimitNOFILE=65536
Environment="CUSTOM_VAR=value"

# 저장하면 /etc/systemd/system/nginx.service.d/override.conf 생성
```

```bash
# 설정 확인 (원본 + override 병합 결과)
systemctl cat nginx
```

override.conf는 원본 파일의 같은 섹션 설정을 **추가**합니다. 기존 값을 완전히 교체하려면 먼저 빈 값으로 초기화한 뒤 새 값을 설정해야 합니다.

```ini
# ExecStart 교체 예시
[Service]
ExecStart=          # 기존 ExecStart 제거
ExecStart=/usr/bin/nginx -g 'daemon off;'  # 새 값
```

## 유용한 보안 설정

```ini
[Service]
# 불필요한 기능 차단
NoNewPrivileges=true
PrivateTmp=true          # 격리된 /tmp 사용
ProtectSystem=strict     # /usr, /boot, /etc 읽기 전용
ProtectHome=true         # 홈 디렉터리 접근 차단
ReadWritePaths=/var/lib/myapp  # 쓰기 허용 경로 명시
```

이 설정들은 서비스가 침해당해도 피해를 최소화합니다. 새 서비스를 만들 때 기본으로 추가하는 것이 좋은 습관입니다.

---

**지난 글:** [systemctl 기본 — 서비스 관리의 핵심](/posts/linux-systemctl-basics/)

**다음 글:** [systemd 타겟 — 런레벨의 현대적 대체](/posts/linux-systemd-targets/)

<br>
읽어주셔서 감사합니다. 😊
