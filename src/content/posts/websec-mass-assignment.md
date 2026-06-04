---
title: "매스 어사인먼트: 자동 속성 바인딩의 함정"
description: "매스 어사인먼트(Mass Assignment) 취약점의 원리, 공격자가 isAdmin·role 같은 민감 필드를 어떻게 조작하는지, 그리고 Allowlist 패턴으로 완벽하게 방어하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 1
type: "knowledge"
category: "Security"
tags: ["매스어사인먼트", "MassAssignment", "OWASP", "입력검증", "권한상승", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-path-traversal/)에서 경로 순회 공격으로 서버 파일을 탈취하는 기법을 살펴봤다. 이번에는 프레임워크의 편리한 기능이 보안 허점으로 돌변하는 **매스 어사인먼트(Mass Assignment)** 취약점을 파헤친다.

## 매스 어사인먼트란?

현대 웹 프레임워크는 HTTP 요청 본문의 파라미터를 모델 객체에 자동으로 바인딩하는 기능을 제공한다. 개발자 편의를 위한 이 기능은, 공격자가 예상치 못한 필드를 요청에 포함시켜 서버 측 객체를 조작할 수 있게 한다.

![매스 어사인먼트 공격 흐름](/assets/posts/websec-mass-assignment-attack.svg)

## 공격 시나리오

사용자 프로필 업데이트 API를 예로 들어보자.

```http
# 정상 요청
PATCH /api/users/me
Content-Type: application/json

{"name": "홍길동", "email": "hong@example.com"}
```

공격자는 문서화되지 않은 필드를 추가해 본다.

```http
# 공격 요청 — isAdmin 필드를 추가
PATCH /api/users/me
Content-Type: application/json

{
  "name": "홍길동",
  "email": "hong@example.com",
  "isAdmin": true,
  "role": "admin",
  "balance": 999999
}
```

취약한 서버가 `req.body` 전체를 그대로 모델에 바인딩하면, 공격자는 일반 사용자 계정을 관리자로 승격시킬 수 있다.

## 취약한 코드 패턴

### Node.js / Express

```javascript
// ❌ 위험: req.body를 직접 전달
app.patch('/api/users/me', async (req, res) => {
  const user = await User.findById(req.user.id)
  await user.update(req.body)  // isAdmin, role 등 모든 필드가 바인딩됨
  res.json(user)
})
```

### Python / Django

```python
# ❌ 위험: 모든 필드 허용
class UserUpdateView(UpdateAPIView):
    serializer_class = UserSerializer  # Meta.fields = '__all__' 이면 위험
```

### Java / Spring

```java
// ❌ 위험: 모델 직접 바인딩
@PutMapping("/api/users/me")
public User updateUser(@RequestBody User user) {
    return userRepository.save(user);  // id, role 등 민감 필드 포함
}
```

## 방어 전략

![매스 어사인먼트 방어 전략](/assets/posts/websec-mass-assignment-defense.svg)

### 1. Allowlist 패턴 (핵심 방어)

허용된 필드만 명시적으로 지정한다.

```javascript
// ✅ 안전: 허용 목록 명시
const ALLOWED_UPDATE_FIELDS = ['name', 'email', 'bio', 'avatarUrl']

app.patch('/api/users/me', async (req, res) => {
  const user = await User.findById(req.user.id)

  // 허용된 필드만 추출
  const updates = {}
  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field]
    }
  }

  await user.update(updates)
  res.json(user)
})
```

### 2. DTO (Data Transfer Object) 패턴

```typescript
// ✅ DTO로 입력 형태 명확히 정의
class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string

  @IsEmail()
  @IsOptional()
  email?: string

  // isAdmin, role 등 민감 필드는 DTO에 없음
}

@Patch('/users/me')
async updateUser(
  @Body() dto: UpdateUserDto,
  @CurrentUser() user: User,
) {
  return this.userService.update(user.id, dto)
}
```

### 3. 프레임워크별 방어

**Ruby on Rails — Strong Parameters:**

```ruby
# ✅ 강력한 파라미터 필터링
def user_params
  params.require(:user).permit(:name, :email, :bio)
  # :is_admin, :role 은 permit에 포함하지 않음
end
```

**Python / Django REST Framework:**

```python
# ✅ 직렬화 클래스에서 필드 명시
class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['name', 'email', 'bio']  # '__all__' 절대 금지
        read_only_fields = ['id', 'is_admin', 'role', 'created_at']
```

## 취약점 탐지 방법

API 문서와 실제 모델을 비교하여 노출되지 않아야 할 필드가 있는지 확인한다.

```bash
# curl로 민감 필드 포함 요청 테스트
curl -X PATCH https://api.example.com/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"test","isAdmin":true,"role":"admin"}'

# 응답에서 isAdmin 값이 변경됐는지 확인
```

## 실제 사례

- **GitHub (2012)**: Rails Mass Assignment 취약점으로 공격자가 임의의 SSH 키를 루비 조직 저장소에 추가
- **GitLab**: 사용자 프로필 업데이트 시 `admin` 플래그 조작 가능
- **여러 SaaS 서비스**: API 설계 실수로 구독 플랜이나 크레딧 잔액 조작

## 핵심 원칙

> **"절대 `req.body` 전체를 모델에 넘기지 말 것."**

입력은 반드시 명시적인 허용 목록(Allowlist)을 통해 필터링해야 한다. 블록리스트(특정 필드만 제외)는 개발자가 새 필드를 추가할 때 빠뜨리기 쉽기 때문에 신뢰할 수 없다.

---

**지난 글:** [Path Traversal: 경로 순회로 서버 파일 탈취하기](/posts/websec-path-traversal/)

**다음 글:** [보안 설정 오류: 잘못된 기본 설정의 위험](/posts/websec-security-misconfiguration/)

<br>
읽어주셔서 감사합니다. 😊
