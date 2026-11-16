FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY content/ /app/content/
COPY backend/ /app/backend/

WORKDIR /app/backend

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

CMD ["sh", "-c", "python -m scripts.seed --demo && python -m scripts.generate_audio --only-missing --demo-synth && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
