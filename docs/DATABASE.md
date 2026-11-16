# HealthYarn Database Schema (`docs/DATABASE.md`)

HealthYarn uses **SQLModel** (`SQLAlchemy 2.0`) over **SQLite** for local/contest demos with a direct connection-string migration path to **PostgreSQL** via `DATABASE_URL`.

## Entity-Relationship Diagram

```mermaid
erDiagram
    TOPICS ||--o{ FAQ_ITEMS : "categorises"
    FAQ_ITEMS ||--o{ TRANSLATIONS : "has language versions"
    FAQ_ITEMS ||--o{ SAMPLE_QUESTIONS : "has training phrasings"
    FAQ_ITEMS ||--o{ QUERY_LOGS : "matched by"
    USERS ||--o{ TRANSLATIONS : "reviews (clinical / language)"
    USERS ||--o{ RED_FLAG_RULES : "clinically reviews"
    USERS ||--o{ AUDIT_LOG : "performs action"

    TOPICS {
        int id PK
        string slug UK
        string icon
        int sort_order
        string name_en
        string name_yo
        string name_ig
    }

    FAQ_ITEMS {
        int id PK
        int topic_id FK
        string intent_key UK
        string source_reference
        bool is_active
    }

    TRANSLATIONS {
        int id PK
        int faq_id FK
        string lang
        string question_text
        string answer_text
        string question_audio_url
        string answer_audio_url
        string audio_takes_json
        string voice_name
        string status
        int clinical_reviewer_id FK
        int language_reviewer_id FK
        string review_comment
        bool regen_requested
        datetime approved_at
        datetime updated_at
    }

    SAMPLE_QUESTIONS {
        int id PK
        int faq_id FK
        string lang
        string phrasing
    }

    RED_FLAG_RULES {
        int id PK
        string lang
        string pattern
        string severity
        string status
        int clinical_reviewer_id FK
    }

    SYSTEM_MESSAGES {
        int id PK
        string key
        string lang
        string text
        string audio_url
        string status
    }

    CLINICS {
        int id PK
        string name
        string lga
        string state
        string phone
        string type
        float lat
        float lng
    }

    USERS {
        int id PK
        string name
        string email UK
        string password_hash
        string role
        bool is_active
        datetime created_at
    }

    QUERY_LOGS {
        int id PK
        string lang
        string input_mode
        int matched_faq_id FK
        float confidence
        string outcome
        int rating
        string unmatched_text
        datetime created_at
    }

    AUDIT_LOG {
        int id PK
        int user_id FK
        string action
        string entity
        int entity_id
        string details
        datetime timestamp
    }
```

## Content Governance State Machine

`draft` -> `clinical_ok` (by `clinical_reviewer`) -> `language_ok` (by `language_reviewer`, only after clinical approval) -> `published` (by `admin`, blocked if text contains `[PLACEHOLDER – NOT REVIEWED]`). Any edit by `editor` or `admin` resets the translation back to `draft`.
