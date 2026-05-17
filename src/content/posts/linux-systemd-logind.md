---
title: "systemd-logind — 세션과 전원 관리"
description: "systemd-logind의 세션 트래킹 구조, loginctl로 세션을 관리하는 방법, logind.conf로 전원 버튼 동작과 유휴 잠금을 설정하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 6
type: "knowledge"
category: "Linux"
tags: ["linux", "systemd", "logind", "session", "loginctl", "power", "seat", "PAM"]
featured: false
draft: false
---

[지난 글](/posts/linux-systemd-tmpfiles/)에서 systemd-tmpfiles로 임시 파일을 선언적으로 관리하는 방법을 배웠습니다. 이번에는 **systemd-logind**를 다룹니다. 사용자 로그인 세션을 추적하고, 디바이스 권한을 부여하며, 전원 버튼 동작을 제어하는 systemd 컴포넌트입니다.

## logind가 하는 일

logind는 다음 세 가지 역할을 맡습니다.

1. **세션 트래킹** — TTY, SSH, GUI 세션을 추적하고 각 세션에 cgroup을 할당합니다.
2. **디바이스 권한** — 로그인한 사용자가 USB, 오디오, GPU 등 하드웨어에 접근할 수 있도록 polkit과 협력합니다.
3. **전원 관리** — 전원 버튼, 덮개 닫기, 유휴 상태에 반응해 suspend·hibernate·shutdown을 실행합니다.

![systemd-logind 구조](/assets/posts/linux-systemd-logind-arch.svg)

## loginctl 명령어

`loginctl`은 logind의 CLI입니다.

```bash
loginctl list-sessions      # 현재 세션 목록 (SESSION, UID, USER, SEAT, TTY)
loginctl list-users         # 로그인된 사용자 목록
loginctl list-seats         # 시트 목록 (물리 콘솔)
```

특정 세션의 상세 정보를 보려면 `show-session`을 사용합니다.

```bash
loginctl show-session 1     # 세션 1의 모든 속성
loginctl show-session 1 -p IdleHint   # 특정 속성만
```

![loginctl 주요 명령어](/assets/posts/linux-systemd-logind-commands.svg)

## 세션 제어

```bash
# 특정 세션 종료
loginctl terminate-session 3

# 사용자의 모든 세션 종료
loginctl terminate-user alice

# 세션 잠금 (화면 보호기 트리거)
loginctl lock-session
loginctl lock-sessions    # 모든 세션 잠금
```

`terminate-session`은 `SIGHUP`을 보내고 세션을 정리합니다. 원격에서 다른 사용자의 세션을 강제 종료할 때 유용합니다.

## logind.conf 설정

`/etc/systemd/logind.conf`에서 전원 버튼 동작과 유휴 동작을 설정합니다.

```ini
[Login]
# 전원 버튼을 눌렀을 때 (poweroff / suspend / hibernate / ignore)
HandlePowerKey=poweroff
HandleSuspendKey=suspend
HandleHibernateKey=hibernate

# 덮개를 닫았을 때
HandleLidSwitch=suspend
HandleLidSwitchExternalPower=ignore   # 외부 전원 연결 시

# 유휴 시간 후 자동 잠금 (0 = 비활성화)
IdleAction=suspend
IdleActionSec=30min

# 동시 로그인 제한 (0 = 무제한)
NAutoVTs=6
```

설정 변경 후에는 logind를 재시작합니다.

```bash
sudo systemctl restart systemd-logind
```

## 사용자 lingering

서버에서 사용자가 로그아웃해도 그 사용자의 서비스(user systemd 인스턴스)를 계속 실행하려면 **lingering**을 활성화합니다.

```bash
# lingering 활성화
loginctl enable-linger alice

# 확인
loginctl show-user alice | grep Linger
# Linger=yes

# 비활성화
loginctl disable-linger alice
```

lingering이 비활성화된 상태에서 사용자가 로그아웃하면 `user@UID.service`가 중단되고, 해당 사용자의 모든 서비스도 함께 종료됩니다. 백그라운드 서비스를 사용자 단위로 실행하는 경우라면 반드시 활성화해야 합니다.

## 세션 D-Bus 접근

logind는 D-Bus 인터페이스를 통해 세션 정보를 노출합니다. 스크립트에서 현재 세션 ID를 얻으려면 다음을 씁니다.

```bash
# 현재 세션 ID
echo $XDG_SESSION_ID

# D-Bus로 직접 조회
busctl call org.freedesktop.login1 /org/freedesktop/login1 \
  org.freedesktop.login1.Manager GetSessionByPID u $$
```

GNOME, KDE 등 데스크톱 환경은 logind D-Bus API를 통해 화면 잠금, 절전 방지(inhibitor), 프레즌스 감지를 구현합니다.

---

**지난 글:** [systemd-tmpfiles — 임시 파일과 디렉터리 자동 관리](/posts/linux-systemd-tmpfiles/)

**다음 글:** [syslog와 rsyslog — 전통적 로깅 인프라](/posts/linux-syslog-rsyslog/)

<br>
읽어주셔서 감사합니다. 😊
