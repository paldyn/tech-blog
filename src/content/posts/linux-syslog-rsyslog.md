---
title: "syslog와 rsyslog — 전통적 로깅 인프라"
description: "syslog 프로토콜의 facility·severity 체계를 이해하고, rsyslog 설정 파일로 로그를 필터링·라우팅하는 방법, journald와 rsyslog의 연동 방식을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 7
type: "knowledge"
category: "Linux"
tags: ["linux", "syslog", "rsyslog", "logging", "facility", "severity", "rsyslog.conf"]
featured: false
draft: false
---

[지난 글](/posts/linux-systemd-logind/)에서 systemd-logind로 세션을 관리하는 방법을 배웠습니다. systemd 저널이 현대적 로깅 인프라로 자리잡았지만, 많은 시스템에서 **rsyslog**가 여전히 동작하고 있습니다. 레거시 애플리케이션 지원, 원격 로그 집계, 텍스트 파일 기반 로그 처리 등 rsyslog만이 제공하는 기능이 있기 때문입니다.

## syslog 프로토콜 기초

syslog 메시지는 **facility**(출처)와 **severity**(심각도)의 조합으로 분류됩니다. 예를 들어 `auth.info`는 인증 서비스(`auth`)에서 정보 수준(`info`)으로 보낸 메시지입니다.

severity를 지정하면 그 수준 **이상**의 메시지가 모두 해당됩니다. `auth.warning`이라고 쓰면 warning, err, crit, alert, emerg가 모두 포함됩니다.

![syslog Facility · Severity](/assets/posts/linux-syslog-rsyslog-facility.svg)

## rsyslog 설정 파일

주 설정 파일은 `/etc/rsyslog.conf`이며, `/etc/rsyslog.d/*.conf`에서 추가 설정을 읽습니다.

```
# /etc/rsyslog.conf 기본 형식
# facility.severity  destination

# 커널 메시지
kern.*              /var/log/kern.log

# 인증 로그
auth,authpriv.*     /var/log/auth.log

# 모든 오류
*.err               /var/log/error.log

# cron 제외한 모든 정보
*.*;cron.none       /var/log/syslog

# 원격 서버로 전송 (@@= TCP, @= UDP)
*.* @@192.168.1.100:514
```

![syslog / rsyslog 로그 흐름](/assets/posts/linux-syslog-rsyslog-arch.svg)

## journald와 rsyslog 연동

Ubuntu, Debian 기본 설정에서는 journald가 `/run/systemd/journal/syslog` 소켓으로 로그를 전달하고, rsyslog가 이를 수신해 파일에 씁니다. 이 방식으로 systemd 서비스의 로그가 `/var/log/syslog`에도 기록됩니다.

```bash
# rsyslog가 journald 소켓을 읽는 모듈
# /etc/rsyslog.conf 에서 확인
module(load="imuxsock")   # /dev/log 소켓
module(load="imjournal")  # journald 직접 연동
```

`imjournal` 모듈을 사용하면 rsyslog가 journald 바이너리 저널에서 직접 읽어 모든 journal 필드를 사용할 수 있습니다.

## 고급 필터링 (RainerScript)

rsyslog 7 이상은 RainerScript라는 스크립트 언어를 지원합니다.

```
# nginx 접근 로그만 별도 파일로
if $programname == 'nginx' and $syslogseverity <= 6 then {
    action(type="omfile" file="/var/log/nginx-access.log")
    stop
}

# IP 주소 포함된 메시지만 원격 전송
if $msg contains '192.168.' then {
    action(type="omfwd" target="siem.example.com" port="514" protocol="tcp")
}
```

## 로그 포맷 변경

기본 포맷 외에 JSON 출력을 설정할 수 있습니다.

```
# JSON 템플릿 정의
template(name="json_lines" type="list") {
    constant(value="{")
    property(name="timereported" dateFormat="rfc3339" format="jsonf")
    constant(value=",")
    property(name="hostname" format="jsonf")
    constant(value=",")
    property(name="msg" format="jsonf")
    constant(value="}\n")
}

# 적용
*.* action(type="omfile" file="/var/log/json.log"
           template="json_lines")
```

## rsyslog 관리

```bash
# 설정 파일 문법 검사
rsyslogd -N1

# 서비스 재시작
sudo systemctl restart rsyslog

# 상태 확인
systemctl status rsyslog
journalctl -u rsyslog -n 20
```

---

**지난 글:** [systemd-logind — 세션과 전원 관리](/posts/linux-systemd-logind/)

**다음 글:** [/var/log 주요 파일 탐방](/posts/linux-var-log-tour/)

<br>
읽어주셔서 감사합니다. 😊
