---
title: "Cluster · Node.js 멀티프로세스"
description: "Node.js cluster 모듈로 멀티코어 CPU를 활용하는 방법을 정리합니다. Primary/Worker 프로세스 분기, 라운드로빈 로드 밸런싱, 무중단 재시작(graceful reload), IPC 메시지, Worker Threads와의 차이점을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Node.js", "cluster", "멀티프로세스", "로드밸런싱", "무중단재시작", "IPC"]
featured: false
draft: false
---

[지난 글](/posts/node-worker-threads/)에서 CPU 집약 작업을 별도 스레드로 분리하는 Worker Threads를 살펴봤습니다. `cluster` 모듈은 다른 접근을 취합니다. 동일한 Node.js 프로세스를 **CPU 코어 수만큼 복제**해 동일한 포트를 공유하며 요청을 분산합니다.

---

## cluster 기본 패턴

![Cluster 기본 패턴](/assets/posts/node-cluster-code.svg)

```js
import cluster from 'cluster';
import { cpus } from 'os';
import http from 'http';

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} 실행 중`);
  for (let i = 0; i < cpus().length; i++) cluster.fork();

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} 종료 (${code})`);
    if (!worker.exitedAfterDisconnect) cluster.fork(); // 비정상 종료 시 재시작
  });
} else {
  http.createServer((req, res) => {
    res.writeHead(200);
    res.end(`Worker ${process.pid} 응답`);
  }).listen(3000);
  console.log(`Worker ${process.pid} 시작`);
}
```

`cluster.isPrimary`(구 `isMaster`)가 `true`인 프로세스가 Primary입니다. `fork()`로 생성된 Worker들은 동일한 파일을 재실행하지만 `isPrimary`가 `false`입니다.

---

## 아키텍처 개요

![Node.js Cluster 아키텍처](/assets/posts/node-cluster-arch.svg)

기본 로드 밸런싱 방식은 **라운드로빈**(Round-Robin)입니다. Primary가 OS 소켓을 소유하고, 들어오는 연결을 워커에 순서대로 전달합니다. Windows에서는 OS 소켓을 직접 나눠 갖는 방식을 사용합니다.

```js
// 로드 밸런싱 방식 변경 (기본: SCHED_RR)
cluster.schedulingPolicy = cluster.SCHED_NONE; // OS에 위임
```

---

## IPC 메시지 — Primary ↔ Worker 통신

별도 프로세스이므로 메모리를 공유하지 않습니다. `process.send()`와 `worker.send()`로 IPC 채널을 통해 메시지를 주고받습니다.

```js
// Primary
cluster.on('message', (worker, msg) => {
  if (msg.type === 'REQUEST_COUNT') {
    worker.send({ type: 'REQUEST_COUNT', count: globalCounter });
  }
});

// Worker
process.on('message', (msg) => {
  if (msg.type === 'REQUEST_COUNT') {
    console.log('총 요청 수:', msg.count);
  }
});

// 요청 수 카운팅 — Worker마다 독립적
let localCount = 0;
http.createServer((req, res) => {
  localCount++;
  if (localCount % 100 === 0) {
    process.send({ type: 'REQUEST_COUNT' }); // Primary에 요청
  }
  // ...
});
```

세션·캐시 같은 공유 상태는 Redis나 외부 저장소를 사용하는 것이 일반적입니다.

---

## Graceful Reload — 무중단 재시작

배포 시 요청 처리를 끊지 않고 Worker를 순차적으로 교체합니다.

```js
// Primary에서 graceful reload 구현
async function gracefulReload() {
  const workers = Object.values(cluster.workers);
  for (const worker of workers) {
    await new Promise((resolve) => {
      cluster.fork(); // 새 워커 먼저 시작
      cluster.once('listening', resolve); // 새 워커 준비 완료 대기
    });
    worker.disconnect(); // 기존 워커에 신규 연결 중단
    await new Promise((resolve) => worker.once('exit', resolve));
  }
  console.log('무중단 재시작 완료');
}

process.on('SIGUSR2', gracefulReload); // kill -USR2 <PID> 로 트리거
```

---

## Worker 설정 분기

```js
if (cluster.isPrimary) {
  // Primary 전용 초기화 — 워커 수, 모니터링
  const numCPUs = cpus().length;
  console.log(`${numCPUs}개 코어에 워커 생성`);

  // 특정 환경 변수를 워커에 전달
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork({ WORKER_ID: i });
  }
} else {
  const workerId = process.env.WORKER_ID;
  // 워커별 설정 적용 가능
}
```

---

## cluster vs Worker Threads

| 항목 | cluster | worker_threads |
|------|---------|----------------|
| 격리 단위 | 프로세스 | 스레드 |
| 메모리 | 별도 힙 | 별도 힙 (SAB 공유 가능) |
| 통신 | IPC (직렬화) | MessagePort (복사/이전) |
| 주 용도 | HTTP 서버 스케일링 | CPU 집약 연산 |
| 충돌 격리 | 강함 | 약함 |
| 시작 비용 | 높음 | 낮음 |

---

## pm2와의 관계

실무에서는 `pm2 start app.js -i max`처럼 PM2가 cluster 모드를 관리합니다. PM2는 무중단 재시작(`pm2 reload`), 로그 집계, 모니터링을 제공합니다. 직접 `cluster`를 사용하는 경우는 세밀한 제어가 필요할 때입니다.

```bash
# PM2 cluster 모드
pm2 start app.js -i max         # CPU 코어 수만큼 클러스터
pm2 reload app                  # 무중단 재시작
pm2 scale app +2                # 워커 추가
```

---

**지난 글:** [Worker Threads · Node.js 멀티스레드](/posts/node-worker-threads/)

**다음 글:** [child_process · Node.js 자식 프로세스](/posts/node-child-process/)

<br>
읽어주셔서 감사합니다. 😊
