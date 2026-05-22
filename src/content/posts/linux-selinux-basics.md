---
title: "SELinux 기초 — 강제 접근 제어(MAC) 입문"
description: "SELinux의 MAC 개념, Enforcing/Permissive/Disabled 모드, 컨텍스트 라벨, chcon/restorecon/semanage 사용법과 AVC 거부 트러블슈팅을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 8
type: "knowledge"
category: "Linux"
tags: ["linux", "selinux", "security", "mac", "enforcing", "permissive", "semanage", "restorecon", "audit"]
featured: false
draft: false
---

[지난 글](/posts/linux-x11-forwarding/)에서 X11 포워딩으로 원격 GUI 앱을 실행하는 방법을 살펴봤습니다. 보안 챕터로 넘어가 **SELinux(Security-Enhanced Linux)**를 다룹니다. RHEL/CentOS/Fedora 계열에서 기본 활성화되어 있는 SELinux는 많은 관리자가 처음 만나면 당황해서 비활성화부터 합니다. 하지만 원리를 이해하면 강력한 방어 계층이 됩니다.

## DAC와 MAC의 차이

기존 Linux 파일 권한은 **DAC(Discretionary Access Control, 임의 접근 제어)**입니다. 파일 소유자가 `chmod`로 권한을 마음대로 바꿀 수 있습니다. root는 모든 파일에 접근할 수 있습니다.

SELinux는 **MAC(Mandatory Access Control, 강제 접근 제어)**입니다. 정책이 커널 수준에서 강제되며, root도 정책에 정의된 범위를 넘을 수 없습니다. Apache가 침해당해도 `httpd_t` 컨텍스트의 범위 밖에는 접근할 수 없습니다.

## 세 가지 모드

```bash
# 현재 모드 확인
getenforce
# Enforcing / Permissive / Disabled

# 일시적 변경 (재부팅 시 /etc/selinux/config 값으로 돌아옴)
setenforce 0   # Permissive (정책 위반 허용, 로그만 기록)
setenforce 1   # Enforcing  (정책 위반 차단 + 로그)
```

영구 변경은 `/etc/selinux/config`에서 `SELINUX=enforcing`을 수정한 뒤 재부팅합니다. `Disabled`에서 `Enforcing`으로 직접 전환하면 재레이블링이 필요합니다.

![SELinux 아키텍처와 정책 적용 흐름](/assets/posts/linux-selinux-architecture.svg)

## 컨텍스트 라벨

SELinux는 모든 파일, 프로세스, 포트에 **컨텍스트(context)** 라벨을 붙입니다. 형식은 `user:role:type:level`입니다.

```bash
# 파일 컨텍스트 확인
ls -Z /var/www/html/index.html
# system_u:object_r:httpd_sys_content_t:s0

# 프로세스 컨텍스트 확인
ps -eZ | grep httpd
# system_u:system_r:httpd_t:s0    ...  httpd

# 포트 컨텍스트 확인
semanage port -l | grep http
# http_port_t  tcp  80, 443, ...
```

가장 중요한 부분은 **type** 필드입니다. httpd 프로세스(`httpd_t`)는 `httpd_sys_content_t` 라벨이 붙은 파일에만 읽기 접근이 허용됩니다.

## 컨텍스트 수정

파일을 다른 위치에서 복사하거나 직접 생성하면 컨텍스트가 틀릴 수 있습니다.

```bash
# 임시 변경 (재레이블링 시 초기화됨)
chcon -t httpd_sys_content_t /srv/mysite/index.html

# 재귀적 적용
chcon -Rt httpd_sys_content_t /srv/mysite/

# 권장: restorecon으로 정책 기본값 복원
restorecon -Rv /var/www/html/

# 새 경로를 정책에 영구 등록 (semanage)
semanage fcontext -a -t httpd_sys_content_t "/srv/mysite(/.*)?"
restorecon -Rv /srv/mysite/
```

`semanage fcontext + restorecon` 조합이 올바른 방법입니다. `chcon`만 쓰면 `restorecon` 실행 시 원래대로 돌아갑니다.

## Boolean — 정책 스위치

SELinux 정책에는 시스템 관리자가 켜고 끌 수 있는 **Boolean** 스위치가 있습니다.

```bash
# 모든 Boolean 목록
getsebool -a | grep httpd

# Apache가 네트워크 연결을 시작할 수 있는지
getsebool httpd_can_network_connect
# httpd_can_network_connect --> off

# 활성화 (-P: 영구 저장)
setsebool -P httpd_can_network_connect on
```

Apache에서 백엔드 API나 DB에 연결할 때 흔히 필요한 Boolean입니다.

## 트러블슈팅

![SELinux 트러블슈팅 플로우](/assets/posts/linux-selinux-troubleshoot.svg)

AVC(Access Vector Cache) 거부 로그는 `/var/log/audit/audit.log`에 기록됩니다.

```bash
# 최근 AVC 거부 확인
ausearch -m avc -ts recent

# sealert: 거부 원인과 해결 방법 제안
sealert -a /var/log/audit/audit.log

# audit2allow: 허용 정책 모듈 자동 생성
audit2allow -w -a
audit2allow -a -M mymodule
semodule -i mymodule.pp
```

**흔한 실수**: SELinux가 문제라고 의심되면 `setenforce 0`으로 전환해 확인하는 것까지는 좋습니다. 그런데 그 상태로 두고 잊어버리는 게 문제입니다. 원인을 파악한 뒤 컨텍스트 수정이나 Boolean 조정으로 해결하고 다시 Enforcing으로 복원하세요.

---

**지난 글:** [X11 포워딩 — SSH로 원격 서버의 GUI 앱 실행하기](/posts/linux-x11-forwarding/)

**다음 글:** [AppArmor 기초 — 프로파일 기반 강제 접근 제어](/posts/linux-apparmor-basics/)

<br>
읽어주셔서 감사합니다. 😊
