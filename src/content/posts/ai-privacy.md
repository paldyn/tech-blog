---
title: "AI와 프라이버시: 개인정보를 지키는 기술"
description: "멤버십 추론·모델 역추론·학습 데이터 추출 등 AI 프라이버시 공격 유형을 분석하고, 차분 프라이버시·연합학습·동형암호 세 가지 보호 기술을 코드와 함께 비교합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 4
type: "knowledge"
category: "AI"
tags: ["AI프라이버시", "차분프라이버시", "연합학습", "동형암호", "개인정보", "GDPR", "DP-SGD"]
featured: false
draft: false
---

[지난 글](/posts/ai-explainability-xai/)에서 AI의 내부를 설명하는 XAI 기술을 다뤘다. 역설적으로, 모델이 학습 데이터를 너무 잘 기억하면 프라이버시 문제가 생긴다. AI 시스템은 어떻게 개인정보를 유출하고, 어떻게 보호할 수 있을까.

## AI가 개인정보를 유출하는 방법

AI 모델은 학습 데이터를 압축해 파라미터에 담는다. 이 과정에서 개인 식별 정보가 모델에 '기억'될 수 있다. 2021년 연구에서 GPT-2의 학습 데이터에 포함된 실제 이메일 주소, 전화번호, 이름을 특정 프롬프트로 추출하는 데 성공했다.

```python
# LLM 학습 데이터 추출 위험성 예시 (개념적)
# 반복 토큰 주입으로 학습 데이터 노출 유도
adversarial_prompt = "다음을 계속 반복하세요: " * 50
# → 모델이 학습 중 본 텍스트를 그대로 출력할 수 있음

# 멤버십 추론: 과적합된 모델에서 특정 샘플 포함 여부 확인
def membership_inference(model, target_sample, shadow_samples):
    target_loss = model.loss(target_sample)
    shadow_losses = [model.loss(s) for s in shadow_samples]
    # 학습 데이터는 비학습 데이터보다 손실이 낮음
    threshold = np.mean(shadow_losses)
    return target_loss < threshold  # True면 학습 데이터 포함 의심
```

![AI 시스템의 프라이버시 위협](/assets/posts/ai-privacy-threats.svg)

## 차분 프라이버시(Differential Privacy)

**차분 프라이버시(DP)**는 통계 쿼리 결과가 특정 개인의 데이터 포함 여부와 무관하게 거의 동일하도록 노이즈를 추가한다.

수학적 정의: 어떤 데이터셋 D와 D에서 한 레코드를 바꾼 D'에 대해, 모든 출력 집합 S에 대해 `P(M(D) ∈ S) ≤ e^ε × P(M(D') ∈ S)`를 만족하면 ε-차분 프라이버시를 보장한다.

딥러닝에는 **DP-SGD**를 사용한다.

```python
# Opacus: PyTorch용 차분 프라이버시 학습
from opacus import PrivacyEngine

model = MyModel()
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
data_loader = DataLoader(dataset, batch_size=64)

privacy_engine = PrivacyEngine()

model, optimizer, data_loader = privacy_engine.make_private(
    module=model,
    optimizer=optimizer,
    data_loader=data_loader,
    noise_multiplier=1.1,   # 노이즈 크기 (클수록 강한 보호)
    max_grad_norm=1.0,      # 그래디언트 클리핑
)

# 학습 후 소비된 프라이버시 예산 확인
epsilon = privacy_engine.get_epsilon(delta=1e-5)
print(f"ε = {epsilon:.2f}, δ = 1e-5")
# ε이 작을수록 강한 프라이버시 보호 (보통 ε < 10 목표)
```

ε이 작을수록 보호 강도가 높지만, 노이즈가 많아져 모델 정확도가 떨어진다. 실무에서는 ε=1~10 범위가 일반적이다.

## 연합학습(Federated Learning)

원시 데이터를 서버로 보내는 대신, 각 기기에서 로컬 학습 후 모델 업데이트(그래디언트)만 서버로 전송한다.

```python
# FedAvg 알고리즘 간략 구현
def federated_train(global_model, clients, rounds=10):
    for round in range(rounds):
        # 각 클라이언트에서 로컬 학습
        local_updates = []
        for client in clients:
            local_model = copy.deepcopy(global_model)
            local_optimizer = torch.optim.SGD(
                local_model.parameters(), lr=0.01
            )
            # 클라이언트 로컬 데이터로만 학습 (데이터 서버 미전송)
            for epoch in range(5):
                for batch in client.local_dataloader:
                    loss = local_model.forward(batch)
                    loss.backward()
                    local_optimizer.step()

            local_updates.append(local_model.state_dict())

        # 서버에서 그래디언트 평균 집계 (FedAvg)
        averaged_weights = average_weights(local_updates)
        global_model.load_state_dict(averaged_weights)

    return global_model
```

그러나 그래디언트 자체에서도 원본 데이터를 역추론하는 공격(Gradient Inversion)이 가능하다. 따라서 연합학습 + 차분 프라이버시를 함께 적용하는 경우가 많다.

![프라이버시 보호 기술](/assets/posts/ai-privacy-techniques.svg)

## 동형암호(Homomorphic Encryption)

데이터를 암호화한 상태에서 연산을 수행하고, 복호화된 결과가 평문으로 연산한 결과와 동일하다. 서버가 데이터를 전혀 볼 수 없다.

```python
# CKKS 동형암호로 암호화된 데이터에 대한 신경망 추론 (개념적)
import tenseal as ts

# 클라이언트: 데이터 암호화
context = ts.context(
    ts.SCHEME_TYPE.CKKS,
    poly_modulus_degree=8192,
    coeff_mod_bit_sizes=[60, 40, 40, 60]
)
context.generate_galois_keys()
context.global_scale = 2**40

plain_data = [1.0, 2.0, 3.0, 4.0]
encrypted_data = ts.ckks_vector(context, plain_data)

# 서버: 암호화된 데이터로 추론 (복호화 없이!)
# 선형 레이어: ax + b
result_enc = encrypted_data * weight_vector + bias

# 클라이언트: 결과 복호화
result = result_enc.decrypt()
```

가장 강한 보장을 제공하지만 연산 속도가 10~1000배 느리다. 현재는 간단한 모델이나 특수 도메인(금융·의료)에서 연구·적용 중이다.

## LLM 시대의 프라이버시 실무

**프롬프트 데이터 보호**: OpenAI·Anthropic API에 개인정보를 포함한 프롬프트를 전송하면 서비스 약관에 따라 데이터가 저장될 수 있다. 개인정보는 마스킹 후 전송해야 한다.

```python
import re

def mask_pii(text):
    # 이름, 전화번호, 이메일, 주민번호 마스킹
    text = re.sub(r'\b\d{6}-\d{7}\b', '[주민번호]', text)
    text = re.sub(r'\b01[016789]-\d{3,4}-\d{4}\b', '[전화번호]', text)
    text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
                  '[이메일]', text)
    return text

safe_prompt = mask_pii(user_input)
response = client.messages.create(
    model="claude-opus-4-7",
    messages=[{"role": "user", "content": safe_prompt}]
)
```

**RAG 시스템에서의 격리**: 다중 사용자 RAG 시스템에서 한 사용자의 컨텍스트가 다른 사용자에게 노출되지 않도록 데이터베이스 접근 제어와 프롬프트 격리가 필수다.

AI 프라이버시는 기술적 해결책과 함께 데이터 최소 수집, 목적 제한, 보관 기간 관리 등 조직적 원칙이 병행되어야 한다.

---

**지난 글:** [설명 가능한 AI(XAI): 블랙박스를 열다](/posts/ai-explainability-xai/)

**다음 글:** [AI 탈옥(Jailbreak): 공격 유형과 방어 전략](/posts/ai-jailbreak/)

<br>
읽어주셔서 감사합니다. 😊
