---
title: "uvicorn과 ASGI: 비동기 서버의 토대"
description: "FastAPI를 떠받치는 ASGI 규약과 그 대표 서버 uvicorn. WSGI와의 차이, 서버와 앱이 분리된 이유, 그리고 개발용과 운영용 실행 방법까지 비동기 웹의 토대를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 4
type: "knowledge"
category: "Python"
tags: ["uvicorn", "ASGI", "WSGI", "비동기", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-fastapi-basics/)에서 FastAPI 앱을 띄울 때 `uvicorn main:app`이라는 명령을 썼다. 그런데 왜 파이썬 파일을 직접 실행하지 않고 별도의 서버를 거치는 걸까? 그 답에는 파이썬 웹 생태계를 떠받치는 중요한 약속이 숨어 있다. 바로 **ASGI**라는 규약과, 그것을 구현한 서버 uvicorn이다. 이 둘을 이해하면 FastAPI 같은 프레임워크가 어떻게 굴러가는지 한층 또렷해진다.

## 서버와 앱은 왜 분리되어 있나

우리가 짠 웹 앱은 "요청을 받아 응답을 만드는 로직"일 뿐, 네트워크 소켓을 열고 HTTP를 파싱하는 일은 하지 않는다. 그 저수준 일을 맡는 것이 **서버**이고, 서버와 앱이 서로 대화하는 표준 규약이 필요하다. 그래야 어떤 서버든 어떤 앱이든 자유롭게 조합할 수 있다.

파이썬에는 오래전부터 이 역할을 하는 **WSGI**가 있었다. Flask나 전통적인 Django는 WSGI 앱이고, Gunicorn 같은 WSGI 서버가 이들을 굴린다. 문제는 WSGI가 **동기 방식**이라는 점이다.

![WSGI vs ASGI](/assets/posts/python-uvicorn-asgi-wsgi-vs-asgi.svg)

WSGI에서는 한 요청을 끝낼 때까지 워커 하나가 거기에 묶인다. DB나 외부 API를 기다리는 긴 I/O 동안 워커는 아무 일도 못 하고 놀게 된다. 또한 WebSocket처럼 연결을 길게 유지하는 통신은 애초에 다루기 어렵다. 이 한계를 풀기 위해 등장한 비동기 확장 규약이 **ASGI(Asynchronous Server Gateway Interface)**다.

## ASGI: 비동기로 확장된 규약

ASGI는 WSGI의 정신을 이어받되, `async`/`await`를 기반으로 다시 설계됐다. 하나의 이벤트 루프가 여러 요청을 동시에 돌볼 수 있어서, 한 요청이 I/O를 기다리는 동안 다른 요청을 처리한다. WebSocket이나 장기 연결도 자연스럽게 지원한다. FastAPI, Starlette, 그리고 최신 Django가 모두 ASGI 앱이다.

서버와 앱이 닿는 흐름을 그려 보면 역할 분담이 분명해진다.

![요청이 앱에 닿기까지](/assets/posts/python-uvicorn-asgi-server-stack.svg)

uvicorn은 네트워크와 이벤트 루프를 맡고, FastAPI 같은 앱은 라우팅과 비즈니스 로직만 책임진다. 둘 사이의 대화 규칙이 ASGI다. 덕분에 앱 코드는 서버가 무엇인지 몰라도 되고, 서버를 다른 ASGI 서버로 바꿔 끼워도 앱은 그대로다.

## uvicorn 실행하기

uvicorn은 가장 널리 쓰이는 ASGI 서버다. 핵심 인자는 `모듈:앱객체` 형식이다.

```bash
# main.py 안의 app 객체를 띄운다
uvicorn main:app --reload

# 호스트·포트 지정
uvicorn main:app --host 0.0.0.0 --port 8000
```

`--reload`는 코드가 바뀌면 서버를 자동으로 다시 띄우는 개발용 옵션이다. 운영 환경에서는 절대 켜지 않는다.

코드 안에서 직접 실행하고 싶다면 `if __name__ == "__main__"` 아래에서 호출할 수도 있다.

```python
import uvicorn

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000)
```

## 운영에서는 Gunicorn과 함께

uvicorn 단독으로도 서비스할 수 있지만, 실무에서는 프로세스 여러 개를 띄워 CPU 코어를 모두 활용하는 경우가 많다. 전통적으로는 Gunicorn을 프로세스 관리자로 두고, 각 워커로 uvicorn을 쓰는 조합을 많이 썼다.

```bash
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker
```

`-w 4`는 워커 4개, `-k`는 워커 종류를 uvicorn으로 지정한다는 뜻이다. 최근 uvicorn은 자체 멀티 워커(`--workers`)도 제공하므로 단독 운영도 한결 수월해졌다.

정리하면, ASGI는 서버와 비동기 앱이 대화하는 표준 약속이고, uvicorn은 그 약속을 구현해 네트워크를 책임지는 서버다. 이 분리 덕분에 우리는 로직에만 집중하고, 서버는 갈아 끼울 수 있는 부품처럼 다룰 수 있다. 다음 글에서는 다시 화면 쪽으로 돌아와, 서버가 만든 데이터를 HTML로 그려 내는 템플릿 엔진 Jinja2를 살펴본다.

---

**지난 글:** [FastAPI 기초: 타입 힌트로 만드는 API](/posts/python-fastapi-basics/)

**다음 글:** [Jinja2 템플릿: 데이터를 HTML로](/posts/python-jinja2-templates/)

<br>
읽어주셔서 감사합니다. 😊
