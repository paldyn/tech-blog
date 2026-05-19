---
title: "Docker 시그널 전파: PID 1과 시그널 처리 완전 정복"
description: "컨테이너에서 PID 1이 시그널을 받는 원리, 셸 형식 CMD가 SIGTERM을 막는 이유, exec 형식과 tini로 해결하는 방법, 자식 프로세스 시그널 전파 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 3
type: "knowledge"
category: "Docker"
tags: ["docker", "signal", "PID1", "SIGTERM", "SIGKILL", "exec", "tini", "프로세스"]
featured: false
draft: false
---

[지난 글](/posts/docker-stop-graceful/)에서 `docker stop`이 SIGTERM을 보내고 타임아웃 후 SIGKILL로 전환하는 흐름을 살펴봤다. 이번에는 그 SIGTERM이 실제로 앱 프로세스까지 전달되는지, 왜 종종 전달되지 않는지를 파헤친다.

## 컨테이너의 PID 1

Linux에서 PID 1은 init 프로세스다. 모든 다른 프로세스의 최상위 조상이며 고아 프로세스를 거두는 역할을 한다. 컨테이너에서는 `CMD` 또는 `ENTRYPOINT`로 지정한 프로세스가 PID 1이 된다.

Docker daemon이 `docker stop`을 실행하면 **컨테이너의 PID 1**에만 시그널을 보낸다. 다른 프로세스에는 직접 시그널을 보내지 않는다. 따라서 PID 1이 시그널을 자식 프로세스에 전파하지 않으면 자식 프로세스는 종료 신호를 받지 못한다.

## 셸 형식 CMD의 함정

```dockerfile
# 위험한 패턴
CMD myapp
CMD /bin/sh -c "myapp --config /etc/app.conf"
```

Dockerfile의 **셸 형식** CMD는 `/bin/sh -c "..."` 로 감싸서 실행한다. 결과적으로 `/bin/sh`가 PID 1이 되고 `myapp`은 셸의 자식 프로세스가 된다.

대부분의 셸은 자식 프로세스에 시그널을 전달하지 않는다. `docker stop`이 `/bin/sh`에 SIGTERM을 보내도 `myapp`은 아무 시그널을 받지 못한 채 타임아웃을 기다리다 SIGKILL로 강제 종료된다.

![PID 1과 시그널 전파](/assets/posts/docker-signal-propagation-pid1.svg)

## exec 형식으로 해결

**JSON 배열(exec 형식)**을 사용하면 셸을 거치지 않고 앱이 직접 PID 1이 된다.

```dockerfile
# 권장
CMD ["myapp", "--config", "/etc/app.conf"]
ENTRYPOINT ["myapp"]
```

셸 처리가 필요한 환경변수 치환 등이 있다면 셸 스크립트 안에서 `exec`를 사용해 셸을 앱으로 교체한다.

```bash
#!/bin/sh
# entrypoint.sh
echo "Config: $APP_CONFIG"
exec myapp --config "$APP_CONFIG"   # exec로 셸을 교체
```

`exec`는 현재 프로세스를 새 프로세스로 교체하므로 PID는 그대로 유지되고 시그널이 직접 전달된다.

## PID 1의 특수성

Linux에서 PID 1은 시그널 처리가 일반 프로세스와 다르다. 일반 프로세스는 SIGTERM의 기본 동작(종료)이 설정돼 있지만, **PID 1은 명시적 핸들러가 없는 시그널은 무시**한다. 이것이 많은 컨테이너에서 SIGTERM이 효과 없는 주된 이유다.

Bash, sh 같은 셸은 이 문제를 인식하고 있어서 PID 1로 실행될 때 일부 시그널 전달을 처리하지만, 완전하지 않다.

이 문제를 근본적으로 해결하려면 **tini** 같은 경량 init 프로세스를 사용한다. 다음 글에서 자세히 다룬다.

## 멀티 프로세스 컨테이너에서 전파

하나의 컨테이너에서 여러 프로세스를 실행할 때(supervisor 등)는 PID 1이 SIGTERM을 받아 모든 자식에게 전달하는 로직을 직접 구현해야 한다.

```bash
#!/bin/sh
# PID를 저장하고 SIGTERM 시 전달
myapp &
APP_PID=$!

nginx -g "daemon off;" &
NGINX_PID=$!

_term() {
  kill -TERM "$APP_PID" 2>/dev/null
  kill -QUIT "$NGINX_PID" 2>/dev/null
  wait "$APP_PID" "$NGINX_PID"
}
trap _term TERM INT
wait
```

`trap`으로 SIGTERM을 잡아 각 자식에게 적절한 시그널을 보내고 `wait`로 종료를 기다린다.

## 시그널 전송 명령어

```bash
# 실행 중인 컨테이너에 시그널 직접 발송
docker kill --signal SIGTERM <container>
docker kill --signal SIGHUP  <container>   # 설정 리로드
docker kill --signal SIGUSR1 <container>

# docker stop은 내부적으로 아래와 동일
docker kill --signal SIGTERM <container>
# 타임아웃 후
docker kill --signal SIGKILL <container>
```

![주요 시그널 참조](/assets/posts/docker-signal-propagation-signals.svg)

## 디버깅: 시그널을 받는지 확인

```bash
# 컨테이너 내부에서 strace로 시그널 추적
docker exec <container> strace -p 1 -e trace=signal

# 또는 간단한 테스트 — 시그널 수신 앱으로 교체
docker run --rm --name test-sig \
  python:3.11-slim \
  python -c "
import signal, time
signal.signal(signal.SIGTERM, lambda *a: print('SIGTERM!'))
while True: time.sleep(1)
"
# 다른 터미널에서
docker stop test-sig
```

---

**지난 글:** [Docker 컨테이너 우아한 종료: SIGTERM과 stop 완전 정복](/posts/docker-stop-graceful/)

**다음 글:** [Docker init 프로세스: tini로 좀비·시그널 문제 해결](/posts/docker-init-process-tini/)

<br>
읽어주셔서 감사합니다. 😊
