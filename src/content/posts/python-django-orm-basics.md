---
title: "Django ORM 기초: 모델로 DB 다루기"
description: "SQL을 직접 쓰지 않고 파이썬 클래스로 데이터베이스를 다루는 Django ORM. 모델 정의와 마이그레이션, CRUD, 그리고 게으른 QuerySet의 동작 원리까지 한 번에 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["Django", "ORM", "데이터베이스", "백엔드", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-flask-basics/)에서 작은 웹 앱으로 요청을 받고 응답을 돌려주는 흐름을 봤다면, 이번엔 그 응답에 담을 데이터가 어디서 오는지를 다룬다. 거의 모든 실무 웹 앱은 데이터베이스를 쓰는데, SQL을 손으로 쓰는 일은 생각보다 번거롭고 실수도 잦다. Django는 **ORM(Object-Relational Mapping)**으로 이 문제를 해결한다. 테이블을 파이썬 클래스로, 한 행을 객체로 다루게 해 주어서, SQL 문자열 대신 익숙한 파이썬 코드로 데이터를 읽고 쓴다.

## 모델: 테이블을 클래스로 정의한다

ORM의 출발점은 모델이다. `models.Model`을 상속한 클래스 하나가 테이블 하나에 대응하고, 클래스 속성이 컬럼이 된다.

```python
from django.db import models

class Book(models.Model):
    title = models.CharField(max_length=200)
    price = models.IntegerField()
    published = models.DateField()

    def __str__(self):
        return self.title
```

`CharField`, `IntegerField`처럼 필드 타입을 지정하면, Django가 이를 적절한 SQL 컬럼 타입으로 번역한다. `id` 기본 키는 자동으로 생긴다. 우리는 SQL 타입을 외울 필요 없이, 파이썬으로 "이 테이블엔 이런 칸이 있다"고만 선언하면 된다.

## 마이그레이션: 클래스를 실제 테이블로

모델을 적었다고 테이블이 바로 생기지는 않는다. 변경 사항을 기록(makemigrations)하고 DB에 적용(migrate)하는 두 단계를 거친다.

![모델 클래스가 DB 테이블이 되기까지](/assets/posts/python-django-orm-basics-model-table.svg)

```bash
python manage.py makemigrations   # 모델 변경을 마이그레이션 파일로 기록
python manage.py migrate          # 그 변경을 실제 DB에 적용
```

마이그레이션 파일은 "테이블을 이렇게 바꿔라"는 지시를 파이썬으로 적어 둔 것이다. 버전 관리에 함께 올리면, 팀원 누구나 같은 명령으로 동일한 스키마를 재현할 수 있다. 컬럼을 추가하거나 바꿀 때도 이 두 명령을 반복하면 된다.

## CRUD: 만들고 읽고 고치고 지운다

테이블이 준비되면 데이터를 다룬다. 생성·조회·수정·삭제 모두 객체 메서드로 이뤄진다.

```python
# 생성
book = Book.objects.create(title="ORM 입문", price=18000)

# 조회
all_books = Book.objects.all()
cheap = Book.objects.filter(price__lt=20000)   # price < 20000
one = Book.objects.get(id=1)                    # 단 하나

# 수정
book.price = 15000
book.save()

# 삭제
book.delete()
```

`objects`는 매니저라 부르는 진입점이고, 그 뒤에 `filter`, `get`, `create` 같은 메서드를 붙여 쓴다. `price__lt`처럼 필드 이름에 `__lt`(미만), `__gte`(이상), `__contains`(포함) 같은 **룩업**을 붙여 조건을 표현하는 것이 Django ORM의 특징이다.

## QuerySet은 게으르다

`filter()`가 돌려주는 것은 결과 목록이 아니라 **QuerySet**이라는 객체다. 그리고 이 QuerySet은 게으르다. 조건을 적어 두기만 할 뿐, 실제로 DB에 쿼리를 보내는 것은 결과가 필요해지는 순간으로 미룬다.

![QuerySet은 게으르다 (lazy)](/assets/posts/python-django-orm-basics-lazy-queryset.svg)

```python
qs = Book.objects.filter(price__lt=20000)   # 아직 DB에 안 감
qs = qs.filter(published__year=2026)         # 조건만 추가, 여전히 안 감

for book in qs:        # 바로 이 순간 SQL 한 번 실행
    print(book.title)
```

조건을 여러 번 이어 붙여도 쿼리는 한 번만 나간다. 반복하거나, `list()`로 감싸거나, 인덱싱하거나, `len()`을 부르는 등 **결과가 필요한 순간**에 비로소 평가된다. 덕분에 조건을 함수 사이로 자유롭게 넘기며 조립해 두고, 마지막에 한 번에 실행하는 식의 깔끔한 코드가 가능하다. 다만 같은 QuerySet을 여러 번 평가하면 그만큼 쿼리가 반복되니, 재사용할 거라면 `list()`로 한 번 굳혀 두는 편이 낫다.

ORM의 가치는 데이터베이스를 "파이썬 객체의 집합"처럼 다루게 해 주는 데 있다. SQL을 몰라도 시작할 수 있고, 모델 한 곳만 고치면 스키마와 코드가 함께 따라온다. 물론 복잡한 쿼리에서는 ORM이 만드는 SQL을 확인하며 다듬는 안목도 필요하다. 다음 글에서는 타입 힌트를 무기로 삼아 자동 문서화까지 해 주는 현대적 프레임워크, FastAPI를 만나 본다.

---

**지난 글:** [Flask 입문: 가장 작은 웹 앱부터](/posts/python-flask-basics/)

**다음 글:** [FastAPI 기초: 타입 힌트로 만드는 API](/posts/python-fastapi-basics/)

<br>
읽어주셔서 감사합니다. 😊
