---
title: "TensorFlow/Keras로 시작하는 딥러닝"
description: "Keras 3.x의 Sequential·Functional·Subclassing API, model.compile/fit/evaluate 패턴, 콜백 시스템, TF Serving 배포까지 TensorFlow/Keras 실전 워크플로를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 4
type: "knowledge"
category: "AI"
tags: ["TensorFlow", "Keras", "딥러닝", "Sequential", "FunctionalAPI", "model.fit", "콜백"]
featured: false
draft: false
---

[지난 글](/posts/pytorch-training-loop/)에서 PyTorch의 저수준 학습 루프를 완성했다. 이번에는 고수준 API로 훨씬 간결하게 모델을 구축하는 **TensorFlow/Keras**를 살펴본다. Google이 주도하는 TensorFlow는 프로덕션 배포 생태계가 특히 강점이다.

## TensorFlow와 Keras의 관계

Keras는 원래 독립 라이브러리였지만 TensorFlow 2.0부터 공식 고수준 API로 통합됐다. 2023년 출시된 **Keras 3.x**는 TensorFlow뿐 아니라 PyTorch, JAX도 백엔드로 지원하는 멀티 프레임워크 라이브러리로 진화했다.

```python
# Keras 3.x 설치 및 백엔드 선택
pip install keras tensorflow

# 백엔드를 PyTorch로 변경 (환경변수 또는 ~/.keras/keras.json)
KERAS_BACKEND=torch python train.py
```

![TensorFlow / Keras API 계층](/assets/posts/tensorflow-keras-api.svg)

실무에서는 여전히 `tf.keras`(TF 내장 버전)를 많이 쓰지만, 신규 프로젝트라면 독립 Keras 3.x 패키지를 권장한다.

## 세 가지 API 스타일

### Sequential API — 선형 스택

입력부터 출력까지 레이어가 직선으로 이어지는 단순 모델에 쓴다.

```python
import keras
from keras import layers

model = keras.Sequential([
    keras.Input(shape=(784,)),
    layers.Dense(256, activation="relu"),
    layers.BatchNormalization(),
    layers.Dropout(0.3),
    layers.Dense(10, activation="softmax"),
])
```

### Functional API — 복잡한 구조

다중 입력·출력, 공유 레이어, 잔차 연결(skip connection)이 필요할 때 사용한다.

```python
inputs = keras.Input(shape=(784,))
x = layers.Dense(256, activation="relu")(inputs)
x = layers.Dropout(0.3)(x)
x = x + layers.Dense(256)(inputs)   # 잔차 연결
outputs = layers.Dense(10)(x)
model = keras.Model(inputs=inputs, outputs=outputs)
```

### Subclassing API — 완전한 커스터마이징

PyTorch `nn.Module`처럼 `call` 메서드에서 완전히 제어한다.

```python
class ResidualBlock(keras.Model):
    def __init__(self, units):
        super().__init__()
        self.dense1 = layers.Dense(units, activation="relu")
        self.dense2 = layers.Dense(units)
        self.add    = layers.Add()

    def call(self, x, training=False):
        residual = x
        x = self.dense1(x)
        x = self.dense2(x)
        return self.add([x, residual])
```

## compile · fit · evaluate

![Keras Functional API + model.fit()](/assets/posts/tensorflow-keras-model-code.svg)

Keras의 핵심 장점은 `compile → fit → evaluate`의 일관된 인터페이스다.

```python
model.compile(
    optimizer=keras.optimizers.Adam(learning_rate=3e-4),
    loss=keras.losses.SparseCategoricalCrossentropy(from_logits=True),
    metrics=["accuracy"],
)

history = model.fit(
    X_train, y_train,
    epochs=50,
    batch_size=64,
    validation_split=0.2,
    callbacks=[
        keras.callbacks.EarlyStopping(monitor="val_loss", patience=5,
                                      restore_best_weights=True),
        keras.callbacks.ModelCheckpoint("best.keras", save_best_only=True),
        keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=3),
        keras.callbacks.TensorBoard(log_dir="logs/"),
    ],
)

test_loss, test_acc = model.evaluate(X_test, y_test)
print(f"Test accuracy: {test_acc:.4f}")
```

`validation_split=0.2`는 학습 데이터의 마지막 20%를 자동으로 검증 셋으로 분리한다. `restore_best_weights=True`를 설정하면 조기 종료 후 최적 가중치가 자동 복원된다.

## tf.data: 고성능 데이터 파이프라인

대규모 데이터셋은 `tf.data.Dataset`으로 최적화한다.

```python
import tensorflow as tf

# 파일에서 직접 로드하는 파이프라인
dataset = (
    tf.data.Dataset.from_tensor_slices((X, y))
    .shuffle(buffer_size=10000)
    .batch(64)
    .prefetch(tf.data.AUTOTUNE)   # 다음 배치 미리 준비
)

# tfrecord (대규모 데이터 권장 포맷)
raw_ds = tf.data.TFRecordDataset("data.tfrecord")
```

`prefetch(AUTOTUNE)`은 GPU가 현재 배치를 처리하는 동안 CPU가 다음 배치를 미리 로딩하게 해서 GPU 유휴 시간을 줄인다.

## 모델 저장 · 배포

```python
# Keras 네이티브 포맷 (.keras)
model.save("model.keras")
loaded = keras.models.load_model("model.keras")

# TF SavedModel 포맷 (TF Serving 호환)
model.export("saved_model/")

# TF Lite (모바일·엣지)
converter = tf.lite.TFLiteConverter.from_saved_model("saved_model/")
tflite_model = converter.convert()
```

TF Serving을 도커로 실행하면 SavedModel을 REST/gRPC API로 즉시 서빙할 수 있다.

```bash
docker run -p 8501:8501 \
  -v /path/to/saved_model:/models/mymodel/1 \
  -e MODEL_NAME=mymodel \
  tensorflow/serving
```

PyTorch가 연구 유연성에서 강점이라면, TensorFlow/Keras는 모바일·서버 배포 생태계(TFX, TF Serving, TF Lite)가 풍부하다. 다음 포스트에서는 사전학습 모델의 허브인 **HuggingFace Transformers**로 넘어간다.

---

**지난 글:** [PyTorch 학습 루프 완전 정복](/posts/pytorch-training-loop/)

**다음 글:** [HuggingFace Transformers 실전 가이드](/posts/huggingface-transformers/)

<br>
읽어주셔서 감사합니다. 😊
