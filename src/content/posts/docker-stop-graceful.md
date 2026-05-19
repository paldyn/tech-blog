---
title: "Docker 컨테이너 우아한 종료: SIGTERM과 stop 완전 정복"
description: "docker stop의 SIGTERM→SIGKILL 흐름, --time 타임아웃 조정, STOPSIGNAL 지시어, 앱별 시그널 핸들러 구현, exit code 해석을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 2
type: "knowledge"
category: "Docker"
tags: ["docker", "stop", "SIGTERM", "SIGKILL", "graceful", "종료", "stopsignal"]
featured: false
draft: false
---

[지난 글](/posts/docker-ulimit/)에서 ulimit으로 컨테이너 리소스 한도를 조정하는 방법을 살펴봤다. 이번에는 컨테이너를 안전하게 종료하는 방법, 즉 `docker stop`이 어떻게 동작하고 앱이 어떻게 협력해야 하는지를 정리한다.

## docker stop의 종료 흐름

`docker stop <container>`를 실행하면 Docker daemon이 PID 1 프로세스에 시그널을 보낸다. 기본 시그널은 **SIGTERM**이다. 앱이 SIGTERM을 받아 정리 작업을 마치고 종료하면 컨테이너는 exit code를 남기고 종료된다.

문제는 앱이 SIGTERM을 무시하거나 너무 오래 걸릴 때다. Docker는 기본 **10초** 타임아웃이 지나면 **SIGKILL**을 보내 강제 종료한다. SIGKILL은 무시할 수 없으며, 앱은 종료 처리를 할 기회를 잃는다.

![docker stop 종료 흐름](/assets/posts/docker-stop-graceful-flow.svg)

## 타임아웃 조정

```bash
# 30초 대기 후 SIGKILL
docker stop --time=30 my-container

# Compose에서도 설정 가능
docker compose stop --timeout 30
```

Compose 파일에서 서비스별로 기본 타임아웃을 지정할 수도 있다.

```yaml
services:
  app:
    image: myapp
    stop_grace_period: 30s   # 기본 10s
```

데이터베이스, 메시지 브로커처럼 종료 전 플러시 작업이 필요한 서비스는 충분한 타임아웃을 설정해야 한다.

## STOPSIGNAL 지시어

앱마다 종료를 트리거하는 시그널이 다르다. nginx는 SIGTERM이 아니라 SIGQUIT로 active connection drain을 진행한다. Dockerfile의 `STOPSIGNAL` 지시어로 종료 시그널을 바꿀 수 있다.

```dockerfile
FROM nginx:alpine
# nginx graceful shutdown 시그널
STOPSIGNAL SIGQUIT
```

`docker run --stop-signal` 플래그로 런타임에도 오버라이드할 수 있다.

```bash
docker run --stop-signal SIGQUIT --stop-timeout 30 nginx
```

![STOPSIGNAL 설정](/assets/posts/docker-stop-graceful-stopsignal.svg)

## 앱에서 SIGTERM 핸들러 구현

컨테이너에서 앱이 PID 1이면 직접 시그널을 받는다. 시그널 핸들러를 구현해 연결 종료, 진행 중인 요청 완료, 파일 플러시 등을 처리해야 한다.

**Node.js 예시**:

```javascript
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await server.close();       // HTTP 서버 연결 drain
  await db.end();             // DB 커넥션 풀 종료
  process.exit(0);
});
```

**Python 예시**:

```python
import signal, sys

def handle_sigterm(sig, frame):
    print("SIGTERM received, cleaning up...")
    cleanup()
    sys.exit(0)

signal.signal(signal.SIGTERM, handle_sigterm)
```

**Go 예시**:

```go
quit := make(chan os.Signal, 1)
signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
<-quit
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()
srv.Shutdown(ctx)
```

## exit code 해석

컨테이너가 종료될 때 `docker ps -a`와 `docker inspect`로 exit code를 확인할 수 있다.

| exit code | 의미 |
|---|---|
| 0 | 정상 종료 |
| 1 | 앱 에러 |
| 130 | SIGINT (Ctrl+C) |
| 137 | SIGKILL (OOM 포함, 타임아웃 강제 종료) |
| 143 | SIGTERM 수신 후 종료 |

```bash
docker inspect --format='{{.State.ExitCode}}' <container>
```

exit code 137이 반복된다면 앱이 SIGTERM을 처리하지 못하거나 OOM으로 커널이 강제 종료한 것이다.

## 셸 스크립트가 PID 1일 때 주의점

```dockerfile
CMD ["/bin/sh", "-c", "exec myapp"]
```

`exec`를 빠뜨리면 셸이 PID 1이 되고 시그널을 자식 프로세스에 전달하지 않는다. `exec myapp`으로 셸 프로세스를 앱 프로세스로 교체해야 SIGTERM이 앱에 직접 전달된다. 자세한 내용은 다음 글에서 다룬다.

---

**지난 글:** [Docker ulimit: 컨테이너 리소스 한도 미세 조정](/posts/docker-ulimit/)

**다음 글:** [Docker 시그널 전파: PID 1과 시그널 처리 완전 정복](/posts/docker-signal-propagation/)

<br>
읽어주셔서 감사합니다. 😊
