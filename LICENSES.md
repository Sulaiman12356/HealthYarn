# Third-Party Models, Code & Licences (`LICENSES.md`)

HealthYarn respectfully credits the following open-source models, APIs, and software packages:

## AI Models & Speech Services
- **YarnGPT (`saheedniyi/YarnGPT2b` / `yarngpt`)** — Created by **Saheed Azeez** (`saheedniyi02`). Used offline via batch synthesis (`backend/scripts/generate_audio.py`) to turn pre-approved health guidance into Nigerian-voiced audio clips. Refer to the Hugging Face model card and repository licence (`Apache-2.0` / model terms).
- **Spitch Speech-to-Text (`spitch`)** — West African ASR API for Yorùbá, Igbo, and Nigerian English used behind our pluggable `STTProvider` interface (`MIT` Python SDK; API governed by Spitch Terms).
- **LaBSE (`sentence-transformers/LaBSE`)** — Language-agnostic BERT Sentence Embedding model (`Apache-2.0`).

## Backend Dependencies
- **FastAPI** (`MIT`) & **Uvicorn** (`BSD-3-Clause`)
- **SQLModel** & **SQLAlchemy** (`MIT`)
- **RapidFuzz** (`MIT`), **scikit-learn** (`BSD-3-Clause`), **NumPy** (`BSD-3-Clause`)
- **SlowAPI** (`MIT`), **bcrypt** (`Apache-2.0`), **PyJWT** (`MIT`)

## Frontend Dependencies
- **React** & **React DOM** (`MIT`)
- **Vite** (`MIT`), **TypeScript** (`Apache-2.0`), **Tailwind CSS** (`MIT`)
- **vite-plugin-pwa** & **Workbox** (`MIT`)
- **Vitest** & **Testing Library** (`MIT`)
