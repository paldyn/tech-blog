---
title: "Jinja2 템플릿: 데이터를 HTML로"
description: "Flask와 Django가 쓰는 템플릿 엔진 Jinja2. 변수 출력과 제어 구문, 필터, 그리고 중복을 없애는 템플릿 상속과 자동 이스케이프까지 서버가 HTML을 그려 내는 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 5
type: "knowledge"
category: "Python"
tags: ["Jinja2", "템플릿", "HTML", "Flask", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-uvicorn-asgi/)에서 서버가 어떻게 요청을 받아 앱에 넘기는지 그 토대를 봤다면, 이번엔 앱이 만든 데이터를 사람이 볼 화면, 즉 **HTML로 그려 내는** 단계를 다룬다. 파이썬 문자열을 `+`로 이어 붙여 HTML을 만들면 금세 지저분해지고 실수가 늘어난다. 그래서 쓰는 것이 템플릿 엔진이다. Python 진영의 사실상 표준은 Jinja2이고, Flask는 기본 내장, Django의 기본 엔진도 Jinja2와 거의 같은 문법을 쓴다.

## 두 가지 구분 기호

Jinja2 문법은 딱 두 종류만 기억하면 된다. 값을 **출력**할 때는 `{{ }}`, 로직을 **실행**할 때는 `{% %}`다.

![템플릿 + 데이터 → HTML](/assets/posts/python-jinja2-templates-render-flow.svg)

```html
<h1>{{ name }}님의 장바구니</h1>

{% if items %}
  <ul>
  {% for item in items %}
    <li>{{ item.title }} — {{ item.price }}원</li>
  {% endfor %}
  </ul>
{% else %}
  <p>장바구니가 비어 있습니다.</p>
{% endif %}
```

`{{ name }}`은 넘겨받은 데이터에서 `name` 값을 꺼내 그 자리에 박는다. `{% for %}`, `{% if %}`는 파이썬과 비슷한 제어 구문이지만, 반드시 `{% endfor %}`, `{% endif %}`로 블록을 닫아 줘야 한다는 점이 다르다.

## 템플릿에 데이터 넘기기

템플릿은 혼자서는 빈 양식일 뿐이고, 여기에 채울 데이터(context)를 파이썬 쪽에서 건네야 한다. Flask에서는 `render_template`을 쓴다.

```python
from flask import render_template

@app.route("/cart")
def cart():
    items = [{"title": "ORM 입문", "price": 18000}]
    return render_template("cart.html", name="PALDYN", items=items)
```

키워드 인자로 넘긴 `name`, `items`가 템플릿 안의 `{{ name }}`, `{% for item in items %}`에 그대로 대응된다. 렌더링은 양식(템플릿)과 데이터(context)를 합쳐 완성된 HTML 문자열을 만드는 과정이다.

## 필터로 값 다듬기

출력하는 값에 파이프(`|`)로 필터를 붙이면 형식을 손쉽게 바꾼다. 대문자 변환, 기본값 지정, 길이 등 자주 쓰는 필터가 내장되어 있다.

```html
<p>{{ name | upper }}</p>            <!-- 대문자로 -->
<p>{{ price | default(0) }}원</p>     <!-- 값 없으면 0 -->
<p>항목 {{ items | length }}개</p>    <!-- 개수 -->
```

필터는 왼쪽 값을 받아 가공한 결과를 돌려준다. 여러 개를 연달아 이어 붙일 수도 있어서, 표시용 가공 로직을 템플릿 안에 깔끔하게 둘 수 있다.

## 상속으로 중복 없애기

여러 페이지가 같은 헤더·푸터·메뉴를 공유한다면, 그것을 매번 복사하는 대신 **공통 뼈대 템플릿**을 하나 두고 페이지마다 달라지는 부분만 채운다. 이것이 Jinja2의 가장 강력한 기능인 템플릿 상속이다.

![템플릿 상속: 공통 뼈대 + 빈칸](/assets/posts/python-jinja2-templates-inheritance.svg)

```html
<!-- base.html -->
<header>로고와 메뉴</header>
{% block content %}{% endblock %}
<footer>공통 푸터</footer>
```

```html
<!-- cart.html -->
{% extends "base.html" %}
{% block content %}
  <h1>장바구니</h1>
{% endblock %}
```

`base.html`에 사이트 공통 구조와 `{% block content %}`라는 빈칸을 만들어 두고, 각 페이지는 `{% extends %}`로 그 뼈대를 물려받아 자기 `block`만 채운다. 헤더와 푸터를 한 곳에서만 관리하면 되니, 디자인이 바뀌어도 base 하나만 고치면 모든 페이지에 반영된다.

## 자동 이스케이프는 켜 두자

Jinja2는 기본적으로 `{{ }}`로 출력되는 값의 특수문자를 HTML 엔티티로 바꾼다. 사용자가 입력한 `<script>`가 코드로 실행되지 않고 글자로 표시되게 만들어, **XSS 공격을 막는** 안전장치다. 정말 신뢰할 수 있는 HTML만 `| safe` 필터로 예외 처리하고, 그 외에는 자동 이스케이프를 끄지 않는 것이 원칙이다.

템플릿 엔진의 핵심은 "구조는 양식에, 값은 데이터에" 분리하는 것이다. 출력엔 `{{ }}`, 로직엔 `{% %}`, 그리고 상속으로 중복을 없애면 화면 코드가 한결 단정해진다. 다음 글에서는 다시 클라이언트 쪽으로 시선을 돌려, 다른 서버에 HTTP 요청을 보내는 두 라이브러리 requests와 httpx를 비교해 본다.

---

**지난 글:** [uvicorn과 ASGI: 비동기 서버의 토대](/posts/python-uvicorn-asgi/)

**다음 글:** [requests vs httpx: HTTP 클라이언트 고르기](/posts/python-requests-vs-httpx/)

<br>
읽어주셔서 감사합니다. 😊
