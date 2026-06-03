---
title: "IDOR: 불안전한 직접 객체 참조 — 가장 흔한 API 취약점"
description: "IDOR의 발생 원리, URL/쿼리/본문/헤더에서의 다양한 공격 패턴, 소유자 검증과 사용자 범위 쿼리(user-scoped query)로 방어하는 방법, 자동화 탐지 기법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 9
type: "knowledge"
category: "Security"
tags: ["IDOR", "웹 보안", "API 보안", "접근 제어", "OWASP", "버그바운티"]
featured: false
draft: false
---

[지난 글](/posts/websec-broken-access-control/)에서 Broken Access Control의 6가지 유형을 개괄적으로 살펴봤습니다. 그 중에서도 버그바운티에서 가장 자주 보고되고 API 보안에서 가장 흔히 발견되는 **IDOR(Insecure Direct Object Reference, 불안전한 직접 객체 참조)**를 이번 글에서 집중적으로 분석합니다.

## IDOR란?

서버가 사용자 요청의 리소스 식별자(ID)를 받아 DB를 조회할 때, 그 리소스가 요청자의 것인지 검증하지 않으면 IDOR입니다. 공격자는 자신의 리소스 ID를 타인의 ID로 바꾸기만 하면 다른 사람의 데이터를 열람하거나 수정할 수 있습니다.

이름이 가리키듯 "직접 객체 참조"가 문제의 핵심입니다. 사용자가 URL이나 파라미터로 DB 레코드를 직접 지목할 수 있고, 서버가 이를 수동적으로 수용하는 구조입니다.

![IDOR: 불안전한 직접 객체 참조 공격 패턴](/assets/posts/websec-idor-attack.svg)

## 공격 벡터별 상세

**URL 경로 파라미터**:

```http
# 계정 1337의 세부 정보
GET /api/users/1337/details

# 1337 대신 다른 ID로 변경
GET /api/users/1338/details  → 타인 정보 노출?
GET /api/users/1/details     → 관리자 정보?
```

**쿼리 파라미터**:

```http
# 청구서 조회
GET /invoices?invoice_id=INV-2026-001

# 파라미터 변조
GET /invoices?invoice_id=INV-2025-001  → 작년 청구서?
GET /invoices?user_id=99999            → 타인 청구서?
```

**POST 본문 (API)**:

```json
// 정상: 본인 계좌에서 이체
{
  "from_account": "ACC-1001",
  "to_account": "ACC-2002",
  "amount": 10000
}

// 공격: from_account를 타인 계좌로 변조
{
  "from_account": "ACC-9999",
  "to_account": "ACC-2002",
  "amount": 10000
}
```

**숨겨진 파라미터**: 응답 JSON에서 노출된 필드를 요청 파라미터로 재사용하는 경우도 있습니다.

```javascript
// 응답에 document_id가 포함된 경우
{
  "id": 42,
  "document_id": 7789,  // 이 필드가 다른 API에서 직접 사용된다면?
  "title": "My Document"
}

// 공격자가 document_id를 변경해 다른 문서 접근 시도
GET /api/documents/7790/download
```

## 취약 코드와 안전 코드 비교

```python
# Django REST Framework (취약)
class OrderDetailView(APIView):
    def get(self, request, order_id):
        # ❌ order_id만으로 조회 — 소유자 확인 없음
        order = Order.objects.get(id=order_id)
        return Response(OrderSerializer(order).data)

# Django REST Framework (안전)
class OrderDetailView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, order_id):
        # ✅ 현재 인증 사용자 + order_id로 복합 조회
        order = get_object_or_404(Order,
                                  id=order_id,
                                  customer=request.user)
        return Response(OrderSerializer(order).data)
```

```javascript
// Node.js Prisma (취약 vs 안전)

// ❌ 취약
async function getDocument(req, res) {
  const doc = await prisma.document.findUnique({
    where: { id: req.params.id }
  });
  res.json(doc);
}

// ✅ 안전 — userId로 범위 제한
async function getDocument(req, res) {
  const doc = await prisma.document.findFirst({
    where: {
      id: req.params.id,
      userId: req.user.id  // 소유자 검증
    }
  });
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json(doc);
}
```

## 사용자 범위 쿼리 패턴

모든 개별 엔드포인트에서 소유자 검증을 추가하는 대신, **쿼리 레벨에서 현재 사용자 범위를 자동으로 적용**하는 패턴이 더 안전합니다.

![IDOR 방어: 소유자 검증과 간접 참조](/assets/posts/websec-idor-defense.svg)

```python
# Django ORM — 사용자 범위 기본 쿼리셋
class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # 모든 조회/수정/삭제가 이 쿼리셋 기준으로 동작
        return Document.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        # 생성 시 owner 자동 설정
        serializer.save(owner=self.request.user)
```

```java
// Spring Data JPA — 메서드 이름으로 소유자 검증
public interface OrderRepository extends JpaRepository<Order, Long> {
    // orderId와 userId 모두 일치하는 경우만 반환
    Optional<Order> findByIdAndUserId(Long id, Long userId);
    
    // 모든 주문 조회도 userId 범위로 제한
    List<Order> findAllByUserId(Long userId);
}

// 서비스 레이어
public Order getOrder(Long orderId, Long currentUserId) {
    return orderRepository.findByIdAndUserId(orderId, currentUserId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
}
```

## 간접 참조 매핑

외부에 DB ID를 직접 노출하는 대신 세션 기반 매핑을 사용하는 방법도 있습니다:

```python
# 세션에 사용자별 매핑 저장
def get_document(request, index):
    # URL에는 1, 2, 3 같은 세션 내 인덱스만 노출
    document_ids = request.session.get('accessible_documents', [])
    
    try:
        real_id = document_ids[int(index)]
    except (IndexError, ValueError):
        return HttpResponse(status=404)
    
    document = Document.objects.get(id=real_id)
    return JsonResponse(document.to_dict())
```

실용적으로는 UUID를 사용하면서 소유자 검증을 병행하는 것이 균형 잡힌 방법입니다.

## 탐지 자동화

```python
# pytest로 IDOR 자동 테스트
import pytest
from django.test import Client

@pytest.mark.django_db
def test_idor_prevention():
    alice = User.objects.create_user('alice', password='pass')
    bob = User.objects.create_user('bob', password='pass')
    
    # Alice의 문서 생성
    doc = Document.objects.create(title='Secret', owner=alice)
    
    # Bob으로 Alice의 문서 접근 시도
    client = Client()
    client.login(username='bob', password='pass')
    
    response = client.get(f'/api/documents/{doc.id}/')
    
    # 404 또는 403이어야 함
    assert response.status_code in [403, 404]
    
    # 응답 본문에 문서 내용이 없어야 함
    assert 'Secret' not in response.content.decode()
```

## 버그바운티에서 IDOR

IDOR는 버그바운티 프로그램에서 가장 흔히 제출되는 취약점 중 하나입니다. 다음 체크리스트로 시스템을 점검합니다:

- 계정 두 개를 만들어 각자의 리소스 ID를 교차해서 접근해본다
- Burp Suite로 트래픽을 캡처해 ID가 노출된 모든 파라미터를 식별한다
- API 응답에 포함된 다른 사용자의 ID를 다른 엔드포인트에서 재사용해본다
- 삭제/수정 작업도 소유자 검증이 적용되는지 확인한다

소유자 검증은 모든 리소스 접근 작업(GET, POST, PUT, PATCH, DELETE)에 빠짐없이 적용되어야 합니다.

---

**지난 글:** [Broken Access Control: 접근 제어 취약점 — OWASP Top 1위](/posts/websec-broken-access-control/)

**다음 글:** [Path Traversal: 경로 순회로 서버 파일 탈취하기](/posts/websec-path-traversal/)

<br>
읽어주셔서 감사합니다. 😊
