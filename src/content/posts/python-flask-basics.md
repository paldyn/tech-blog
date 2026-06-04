---
title: "Flask 입문: 가장 작은 웹 앱부터"
description: "마이크로 웹 프레임워크 Flask의 기본기. 다섯 줄짜리 앱으로 라우팅을 이해하고, 변수 규칙과 HTTP 메서드, 그리고 템플릿과 JSON 응답까지 웹 서버의 출발점을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 1
type: "knowledge"
category: "Python"
tags: ["Flask", "웹", "라우팅", "백엔드", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-time-series-pandas/)에서 데이터를 시간 축 위에서 다루는 법을 봤다면, 이제는 그렇게 다룬 결과를 **바깥 세상에 내보내는** 이야기로 넘어간다. 분석한 값을 웹 페이지로 보여 주거나, 다른 프로그램이 호출할 수 있는 API로 열어 두려면 웹 서버가 필요하다. Python 진영에서 그 첫걸음으로 가장 자주 권하는 것이 Flask다. "마이크로 프레임워크"라는 이름처럼 군더더기 없이 작게 시작할 수 있어서, 웹이 어떻게 돌아가는지 손에 잡힌다.

## 다섯 줄로 시작하는 웹 앱

Flask 앱은 정말로 몇 줄이면 동작한다. 핵심은 `Flask` 객체를 만들고, 함수에 URL을 붙이는 것뿐이다.

![최소 Flask 앱의 구성](/assets/posts/python-flask-basics-app-structure.svg)

```python
from flask import Flask

app = Flask(__name__)

@app.route("/hello")
def hello():
    return "Hello, Flask!"
```

`app = Flask(__name__)`는 애플리케이션 객체를 만든다. `__name__`을 넘기는 것은 Flask가 템플릿이나 정적 파일의 위치를 찾을 기준점을 잡기 위해서다. 그 아래 `@app.route("/hello")`는 "누군가 `/hello` 주소로 들어오면 이 함수를 실행하라"는 연결이다. 이렇게 URL과 함수를 묶는 것을 **라우팅(routing)**이라 부른다.

실행은 개발용으로 다음처럼 한다.

```bash
flask --app app run --debug
```

`--debug`를 켜면 코드를 고칠 때마다 서버가 자동으로 다시 뜨고, 오류가 나면 브라우저에 자세한 추적 정보가 표시된다. 개발 중에만 켜고, 실제 서비스에서는 반드시 끈다.

## 요청이 응답이 되기까지

브라우저가 주소를 치면 Flask 안에서 어떤 일이 벌어지는지 그림으로 보면 이해가 빠르다.

![Flask 요청 처리 흐름](/assets/posts/python-flask-basics-request-flow.svg)

요청이 들어오면 Flask는 먼저 URL을 보고 어떤 뷰 함수가 맞는지 고른다(라우팅). 고른 함수를 실행하고, 그 함수가 `return`한 값을 HTTP 응답으로 감싸 브라우저에 돌려준다. 우리가 신경 쓸 부분은 거의 **뷰 함수의 내용**뿐이고, 나머지 연결과 응답 포장은 Flask가 대신해 준다.

## URL 안에 변수 담기

주소의 일부를 함수의 인자로 받을 수도 있다. 꺾쇠 괄호로 자리를 만들면 된다.

```python
@app.route("/user/<username>")
def show_user(username):
    return f"안녕하세요, {username}님"

@app.route("/post/<int:post_id>")
def show_post(post_id):
    return f"게시글 번호: {post_id}"
```

`<username>`은 문자열로 들어오고, `<int:post_id>`처럼 변환기를 붙이면 정수로 받는다. `/post/abc`처럼 숫자가 아닌 값이 오면 Flask가 알아서 404를 돌려주므로, 타입 검사를 직접 할 필요가 줄어든다.

## GET과 POST 구분하기

폼을 처리하려면 같은 URL이라도 HTTP 메서드를 나눠야 한다. `methods`로 허용 메서드를 지정하고, `request` 객체로 들어온 값을 읽는다.

```python
from flask import request

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        user = request.form["username"]   # 폼으로 받은 값
        return f"{user} 로그인 시도"
    return "로그인 폼을 보여 줍니다"
```

`request.method`로 분기하고, `request.form`이나 `request.args`(쿼리 스트링)로 입력을 가져온다. 메서드를 지정하지 않으면 기본은 GET만 허용된다.

## HTML과 JSON 돌려주기

문자열만 돌려주는 건 연습용이고, 실제로는 HTML 페이지나 JSON 데이터를 응답한다. HTML은 `render_template`로 템플릿 파일을 채워 내보내고, API라면 딕셔너리를 그대로 반환하면 Flask가 JSON으로 바꿔 준다.

```python
from flask import render_template, jsonify

@app.route("/")
def index():
    return render_template("index.html", name="PALDYN")

@app.route("/api/status")
def status():
    return jsonify({"ok": True, "version": 1})
```

최근 Flask는 뷰가 딕셔너리를 반환하면 자동으로 JSON 응답으로 처리하므로, 간단한 API는 `return {"ok": True}`만으로도 충분하다.

Flask의 매력은 "필요한 만큼만 쓴다"는 데 있다. 라우팅이라는 한 가지 개념에서 출발해, 변수 규칙·메서드·템플릿·JSON을 하나씩 더해 가며 작은 앱을 키운다. 이 가벼움 덕분에 웹의 동작 원리가 그대로 드러난다. 다음 글에서는 데이터베이스를 코드로 다루는 또 다른 큰 흐름, Django의 ORM을 살펴본다.

---

**지난 글:** [pandas 시계열: 날짜 인덱스와 리샘플링](/posts/python-time-series-pandas/)

**다음 글:** [Django ORM 기초: 모델로 DB 다루기](/posts/python-django-orm-basics/)

<br>
읽어주셔서 감사합니다. 😊
