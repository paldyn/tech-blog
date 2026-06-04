---
title: "requests vs httpx: HTTP 클라이언트 고르기"
description: "외부 API를 호출하는 두 라이브러리 requests와 httpx를 비교합니다. 거의 같은 사용법, Session/Client로 연결 재사용, 비동기 지원과 HTTP/2까지 어느 쪽을 언제 쓸지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 6
type: "knowledge"
category: "Python"
tags: ["requests", "httpx", "HTTP", "비동기", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-jinja2-templates/)에서 서버가 데이터를 HTML로 그려 내는 쪽을 봤다면, 이번엔 반대로 우리 프로그램이 **다른 서버에 요청을 보내는** 쪽을 다룬다. 날씨 API를 부르거나, 결제 서버에 데이터를 넘기거나, 다른 마이크로서비스를 호출할 때 쓰는 것이 HTTP 클라이언트다. Python에서는 오랫동안 `requests`가 사실상 표준이었는데, 비동기 시대로 오면서 `httpx`라는 강력한 대안이 자리를 잡았다. 둘은 놀랍도록 닮았지만 결정적인 차이가 있다.

## 가장 익숙한 도구: requests

`requests`는 "사람을 위한 HTTP"라는 슬로건으로 유명하다. 직관적이고 안정적이라, 동기 스크립트에서는 여전히 가장 무난한 선택이다.

```python
import requests

r = requests.get("https://api.example.com/books", params={"q": "python"})
r.raise_for_status()          # 4xx·5xx면 예외를 던진다
data = r.json()               # 응답 본문을 JSON으로 파싱
print(r.status_code, data)
```

`get`, `post` 같은 메서드에 `params`(쿼리), `json`(본문), `headers`를 넘기면 끝이다. `raise_for_status()`로 오류 응답을 예외로 바꾸고, `.json()`으로 본문을 파이썬 객체로 받는다. 표준 라이브러리의 `urllib`보다 훨씬 간결해서 빠르게 익힐 수 있다.

## 거의 같은 얼굴의 httpx

`httpx`는 requests의 사용법을 거의 그대로 따라 한다. import만 바꿔도 대부분의 코드가 동작할 정도다.

```python
import httpx

r = httpx.get("https://api.example.com/books", params={"q": "python"})
r.raise_for_status()
data = r.json()
```

겉모습이 같은데 왜 새 라이브러리가 필요할까? 핵심은 requests가 할 수 없는 일을 httpx가 한다는 데 있다.

![requests vs httpx](/assets/posts/python-requests-vs-httpx-comparison.svg)

httpx는 **동기와 비동기를 모두** 지원하고, HTTP/2를 쓸 수 있으며, 타임아웃이 기본으로 켜져 있다. requests는 동기 전용이고 HTTP/2를 지원하지 않으며 타임아웃을 명시하지 않으면 무한정 기다린다. 자료와 예제의 풍부함은 여전히 requests가 앞서지만, 새 프로젝트나 비동기 코드라면 httpx가 점점 기본이 되고 있다.

## 비동기가 갈림길이다

가장 큰 차이는 비동기다. 수십 개의 외부 API를 동시에 호출해야 하는 상황에서, 동기 클라이언트는 하나가 끝나야 다음을 시작한다. httpx의 `AsyncClient`는 응답을 기다리는 동안 다른 요청을 진행해 전체 시간을 크게 줄인다.

![같은 일을 동기로도, 비동기로도](/assets/posts/python-requests-vs-httpx-sync-async.svg)

```python
import asyncio
import httpx

async def fetch_all(urls):
    async with httpx.AsyncClient() as client:
        tasks = [client.get(u) for u in urls]
        results = await asyncio.gather(*tasks)   # 동시에 진행
        return [r.json() for r in results]

data = asyncio.run(fetch_all(urls))
```

`async with`로 클라이언트를 열고 `await client.get(...)`으로 호출하면, 여러 요청이 이벤트 루프 위에서 동시에 진행된다. FastAPI 같은 비동기 프레임워크 안에서 외부 API를 부를 때 이 방식이 자연스럽게 들어맞는다.

## 연결을 재사용하자: Session과 Client

같은 서버에 요청을 여러 번 보낸다면, 매번 새 연결을 맺는 대신 연결을 재사용하는 편이 훨씬 빠르다. requests는 `Session`, httpx는 `Client`로 이를 제공한다.

```python
# requests
with requests.Session() as s:
    s.headers.update({"Authorization": "Bearer token"})
    s.get("https://api.example.com/a")
    s.get("https://api.example.com/b")   # 연결·헤더 재사용

# httpx
with httpx.Client(base_url="https://api.example.com") as c:
    c.get("/a")
    c.get("/b")
```

세션/클라이언트를 쓰면 TCP 연결과 헤더, 인증 정보를 묶어 재사용하므로 반복 호출의 비용이 줄어든다. `base_url`을 한 번 정해 두고 경로만 넘기는 패턴도 깔끔하다.

정리하면, 단순한 동기 스크립트나 기존 코드라면 requests가 여전히 든든하고, 비동기가 필요하거나 새로 시작하는 프로젝트라면 거의 같은 사용법에 더 많은 기능을 주는 httpx가 좋은 선택이다. 두 라이브러리의 API가 닮은 덕에 옮겨 가는 부담도 작다. 다음 글에서는 이렇게 받아 온 데이터가 우리가 기대한 모양이 맞는지 검증해 주는 강력한 도구, Pydantic을 만나 본다.

---

**지난 글:** [Jinja2 템플릿: 데이터를 HTML로](/posts/python-jinja2-templates/)

**다음 글:** [Pydantic: 데이터 검증을 타입으로](/posts/python-pydantic-validation/)

<br>
읽어주셔서 감사합니다. 😊
