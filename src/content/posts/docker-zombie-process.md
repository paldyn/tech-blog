---
title: "Docker 좀비 프로세스: 발생 원인과 방지 전략"
description: "좀비 프로세스가 생기는 원리, 컨테이너에서의 영향, ps aux Z 상태 탐지, tini/SIGCHLD로 방지하는 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 5
type: "knowledge"
category: "Docker"
tags: ["docker", "zombie", "process", "PID1", "tini", "SIGCHLD", "wait", "좀비프로세스"]
featured: false
draft: false
---

[지난 글](/posts/docker-init-process-tini/)에서 tini가 좀비 프로세스를 수거한다고 언급했다. 이번에는 좀비 프로세스가 구체적으로 무엇이고, 언제 문제가 되며, 어떻게 방지하는지 살펴본다.

## 좀비 프로세스란

Unix에서 프로세스가 종료되면 커널은 해당 프로세스의 PID 테이블 엔트리를 즉시 지우지 않는다. exit code와 리소스 사용 통계를 부모 프로세스가 조회할 수 있도록 잠시 보관한다. 부모가 `wait()` 또는 `waitpid()` syscall을 호출해 exit status를 수거하면 그때 엔트리가 완전히 제거된다.

부모가 `wait()`를 호출하지 않은 채 자식 프로세스가 종료 상태로 남아있는 것을 **좀비 프로세스**라 한다. `ps aux`에서 **Z** 상태로 나타나며, `/proc/<PID>` 디렉터리가 남아있다.

좀비는 CPU나 메모리를 사용하지 않는다. 그러나 PID 슬롯을 점유한다. 시스템의 PID 한도(`/proc/sys/kernel/pid_max`, 기본 32768)가 가득 차면 `fork()` 실패가 발생한다.

![좀비 프로세스 생애 주기](/assets/posts/docker-zombie-lifecycle.svg)

## 컨테이너에서 좀비가 생기는 상황

컨테이너에서 좀비가 발생하는 일반적인 패턴이다.

**멀티 스레드 앱에서 보조 프로세스를 spawn** — Node.js `child_process.spawn()`, Python `subprocess.Popen()`, Go `exec.Command()` 등으로 자식 프로세스를 만든 뒤 wait를 적절히 처리하지 않을 때다.

**supervisor/cron 없는 init** — 앱이 PID 1이면서 다른 프로세스를 spawn하는 경우다. PID 1은 자동으로 고아 프로세스를 입양하지만, wait()로 수거하지 않으면 좀비가 쌓인다.

**짧은 수명의 작업 프로세스 반복 실행** — 헬스체크, 크론 잡, 훅 스크립트 등이 반복적으로 fork/exec되고 부모가 수거를 안 할 때다.

## 컨테이너에서 좀비 탐지

```bash
# Z 상태 프로세스 확인
docker exec <container> ps aux | grep ' Z '

# 구체적인 프로세스 정보
docker exec <container> cat /proc/<PID>/status | grep -E 'Name|State|PPid'

# 좀비 수
docker exec <container> ps aux | awk '{print $8}' | grep -c Z
```

![좀비 탐지 및 방지](/assets/posts/docker-zombie-detect.svg)

## 방지 방법

**① tini 사용 (권장)**

tini는 SIGCHLD를 받아 `waitpid(-1, &status, WNOHANG)`으로 모든 종료된 자식을 자동 수거한다. PID 1에 tini를 두면 고아 프로세스가 입양된 후 즉시 수거된다.

```dockerfile
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
```

**② 앱에서 SIGCHLD 핸들러 구현**

앱이 PID 1이거나 직접 자식을 spawn하는 경우 SIGCHLD 핸들러를 설정해 wait를 처리한다.

```python
import signal, os

def reap_children(signum, frame):
    while True:
        try:
            pid, _ = os.waitpid(-1, os.WNOHANG)
            if pid == 0:
                break
        except ChildProcessError:
            break

signal.signal(signal.SIGCHLD, reap_children)
```

```go
// Go: cmd.Wait()를 goroutine에서 항상 호출
go func() {
    cmd.Wait()
}()
```

**③ SA_NOCLDWAIT 플래그**

C/C++ 앱이라면 `sigaction`으로 `SA_NOCLDWAIT`를 설정하면 자식 종료 시 자동으로 수거된다. 좀비 상태 없이 즉시 제거된다.

```c
struct sigaction sa;
sa.sa_handler = SIG_DFL;
sa.sa_flags = SA_NOCLDWAIT;
sigaction(SIGCHLD, &sa, NULL);
```

## Node.js에서 자식 프로세스 올바르게 처리

```javascript
const { spawn } = require('child_process');

function runTask(cmd) {
  const child = spawn(cmd, [], { detached: false });
  child.on('close', (code) => {
    // close 이벤트: 스트림 종료 + 자동 wait() — 좀비 안 생김
    console.log(`Task exited: ${code}`);
  });
}
```

Node.js `child_process`는 내부적으로 libuv가 SIGCHLD를 처리하므로, `close` 또는 `exit` 이벤트를 리스닝하면 좀비가 생기지 않는다. 단, `detached: true` + `unref()`로 완전히 분리하면 부모가 종료된 후 고아가 되므로 tini 같은 것이 필요하다.

## 요약

좀비는 `wait()` 없는 자식 종료로 생긴다. 컨테이너에서는 PID 1에 tini를 두는 것이 가장 간단하고 효과적인 해결책이다. 앱이 직접 자식을 많이 spawn한다면 언어별 비동기 wait 패턴도 함께 적용한다.

---

**지난 글:** [Docker init 프로세스: tini로 좀비·시그널 문제 해결](/posts/docker-init-process-tini/)

**다음 글:** [Docker 로깅 드라이버: 로그 수집·전달 완전 정복](/posts/docker-logging-drivers/)

<br>
읽어주셔서 감사합니다. 😊
