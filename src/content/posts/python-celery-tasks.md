---
title: "Celery: 무거운 작업을 백그라운드로"
description: "시간이 오래 걸리는 작업을 요청 흐름 밖으로 떼어 내는 작업 큐 Celery. 생산자·브로커·워커 구조, .delay() 호출, 작업 상태 추적과 재시도까지 비동기 작업 처리의 기본을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 9
type: "knowledge"
category: "Python"
tags: ["Celery", "작업큐", "비동기", "백그라운드", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-marshmallow/)에서 데이터를 검증하고 직렬화하는 도구를 봤다면, 이번엔 웹 서비스가 마주치는 또 다른 고민을 다룬다. 사용자가 버튼을 눌렀는데 그 처리가 10초, 30초씩 걸린다면? 이메일 수백 통 발송, 이미지 변환, 리포트 생성 같은 무거운 작업을 요청 안에서 그대로 처리하면 사용자는 응답을 받지 못한 채 한참을 기다려야 한다. 해법은 그 일을 **요청 흐름 밖으로 떼어 내는** 것이다. Celery는 이런 백그라운드 작업을 다루는 Python의 대표적인 분산 작업 큐다.

## 세 등장인물: 생산자·브로커·워커

Celery를 이해하는 핵심은 세 역할의 분리다. 작업을 요청하는 **생산자**(웹 앱), 작업을 쌓아 두는 **브로커**(메시지 큐), 작업을 꺼내 실제로 처리하는 **워커**다.

![Celery 구조: 보내고, 쌓고, 처리한다](/assets/posts/python-celery-tasks-architecture.svg)

웹 앱은 "이 작업을 해 달라"는 메시지를 브로커에 던지기만 하고 즉시 사용자에게 응답한다. 브로커(보통 Redis나 RabbitMQ)는 그 작업을 큐에 쌓아 둔다. 별도 프로세스로 돌고 있는 워커가 큐에서 작업을 하나씩 꺼내 실행한다. 이 구조 덕분에 무거운 일이 요청-응답 사이클을 막지 않는다. 워커를 여러 대 띄우면 작업을 나눠 처리할 수도 있다.

## 작업 정의하기

Celery 앱을 만들고, 함수에 `@app.task` 데코레이터를 붙이면 그 함수가 백그라운드로 보낼 수 있는 **작업(task)**이 된다.

```python
from celery import Celery

# 브로커로 Redis 사용
app = Celery("tasks", broker="redis://localhost:6379/0",
             backend="redis://localhost:6379/1")

@app.task
def send_email(to, subject):
    # 실제로는 시간이 걸리는 작업
    print(f"{to}에게 '{subject}' 발송")
    return "sent"
```

`broker`는 작업을 쌓아 둘 큐, `backend`는 작업 결과를 저장할 곳이다. 워커는 별도 명령으로 띄운다.

```bash
celery -A tasks worker --loglevel=info
```

## .delay()로 작업을 던진다

핵심은 함수를 **그냥 호출하지 않고** `.delay()`로 보낸다는 점이다. 직접 호출하면 그 자리에서 실행되지만, `.delay()`는 작업을 큐에 등록만 하고 곧장 반환한다.

```python
# 그냥 호출 → 지금 여기서 실행 (블로킹)
send_email("a@b.com", "안녕")

# .delay() → 큐에 던지고 즉시 반환 (논블로킹)
result = send_email.delay("a@b.com", "안녕")
print(result.id)        # 작업 ID — 나중에 추적용
```

`.delay()`가 돌려주는 것은 결과 그 자체가 아니라 `AsyncResult` 객체다. 작업은 워커가 처리하는 중이거나 아직 큐에서 대기 중일 수 있으므로, 이 객체로 나중에 상태와 결과를 조회한다. 인자를 더 세밀하게 제어하려면 `apply_async(args=[...], countdown=10)`처럼 쓸 수도 있다.

## 상태 추적과 재시도

작업은 큐에 등록된 뒤 여러 상태를 거친다. 대기(PENDING) → 실행(STARTED) → 성공(SUCCESS) 또는 실패(FAILURE)로 흐르고, 호출 쪽은 `AsyncResult`로 이를 들여다본다.

![작업의 상태 변화](/assets/posts/python-celery-tasks-lifecycle.svg)

```python
result = send_email.delay("a@b.com", "안녕")

print(result.status)     # 'PENDING' → 'SUCCESS'
print(result.ready())    # 끝났는지 여부
print(result.get(timeout=10))   # 결과 (끝날 때까지 대기)
```

외부 API 호출처럼 실패할 수 있는 작업은 자동 재시도를 걸어 두면 든든하다.

```python
@app.task(bind=True, max_retries=3, default_retry_delay=5)
def fetch_data(self, url):
    try:
        return call_external(url)
    except Exception as exc:
        raise self.retry(exc=exc)   # 5초 뒤 다시 시도, 최대 3번
```

`bind=True`로 `self`를 받으면 그 안에서 `self.retry()`를 불러 일시적 실패를 자동으로 다시 시도하게 만든다. 일정 주기로 도는 작업은 Celery Beat 스케줄러로 예약할 수 있어, 정기 배치 작업도 같은 틀로 다룬다.

Celery의 본질은 "오래 걸리는 일을 지금 처리하지 말고 큐에 맡긴다"는 한 문장이다. 요청은 빠르게 응답하고, 무거운 작업은 워커가 뒤에서 안정적으로 처리하며, 결과는 나중에 추적한다. 다음 글이자 이 묶음의 마지막 글에서는 데이터베이스로 다시 돌아가, ORM과 SQL을 한 라이브러리에서 모두 다루는 강력한 도구 SQLAlchemy를 살펴본다.

---

**지난 글:** [marshmallow: 스키마 기반 직렬화](/posts/python-marshmallow/)

**다음 글:** [SQLAlchemy ORM: 파이썬으로 SQL 다루기](/posts/python-sqlalchemy-orm/)

<br>
읽어주셔서 감사합니다. 😊
