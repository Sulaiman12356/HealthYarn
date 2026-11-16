# HealthYarn Evaluation Results (`evaluate.py`)

- **Evaluated threshold**: `0.51`
- **Red-flag recall**: **100.0%**
- **Red-flag precision**: **100.0%**
- **Overall FAQ accuracy**: **97.1%**
- **Wrong match rate**: **0.0%**
- **Unsure fallback rate**: **2.9%**
- **Out-of-scope (`NONE`) rejection accuracy**: **100.0%**
- **Average pipeline latency**: `4.05 ms`

## Per-Language Breakdown

| Language | FAQ Cases | Correct | Unsure | Wrong | Accuracy |
| --- | ---: | ---: | ---: | ---: | ---: |
| `en` | 20 | 20 | 0 | 0 | 100.0% |
| `yo` | 8 | 7 | 1 | 0 | 87.5% |
| `ig` | 7 | 7 | 0 | 0 | 100.0% |

## Threshold Sweep Summary (`0.45` – `0.80`)

- **Recommended `MATCH_THRESHOLD`**: **`0.51`** (Accuracy `97.1%`, Wrong rate `0.0%`, Unsure rate `2.9%`)

| Threshold | Accuracy | Wrong Rate | Unsure Rate | Red-Flag Recall |
| ---: | ---: | ---: | ---: | ---: |
| `0.45` | 97.1% | 0.0% | 2.9% | 100.0% |
| `0.50` | 97.1% | 0.0% | 2.9% | 100.0% |
| `0.51` | 97.1% | 0.0% | 2.9% | 100.0% |
| `0.55` | 94.3% | 0.0% | 5.7% | 100.0% |
| `0.60` | 91.4% | 0.0% | 8.6% | 100.0% |
| `0.65` | 85.7% | 0.0% | 14.3% | 100.0% |
| `0.70` | 74.3% | 0.0% | 25.7% | 100.0% |
| `0.75` | 60.0% | 0.0% | 40.0% | 100.0% |
| `0.80` | 51.4% | 0.0% | 48.6% | 100.0% |

## Confusion List

No misclassifications or false red-flag hits observed.
