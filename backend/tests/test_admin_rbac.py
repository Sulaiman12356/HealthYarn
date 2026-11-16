"""Tests for staff portal RBAC, review workflow, CSRF, and placeholder publish guard."""

from sqlmodel import select

from app.models import AuditLog, Translation


def _login_as(client, email: str, password: str) -> str:
    res = client.post("/api/admin/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["csrf_token"]


def test_public_cannot_access_admin_routes(client):
    assert client.get("/api/admin/items").status_code == 401
    assert client.get("/api/admin/stats").status_code == 401
    assert client.post("/api/admin/translations/1/publish").status_code == 401


def test_rbac_matrix_and_approval_pipeline(client, seeded_session):
    # Grab FAQ 1's English and Yoruba translations
    en_tr = seeded_session.exec(
        select(Translation).where(Translation.faq_id == 1, Translation.lang == "en")
    ).first()
    yo_tr = seeded_session.exec(
        select(Translation).where(Translation.faq_id == 1, Translation.lang == "yo")
    ).first()
    assert en_tr and yo_tr

    # 1. Editor edits FAQ 1 with real reviewed text -> resets status to draft
    csrf = _login_as(client, "editor@healthyarn.ng", "HealthYarnEditor2026!")
    r_edit = client.put(
        "/api/admin/items/1",
        headers={"X-CSRF-Token": csrf},
        json={
            "source_reference": "WHO Updated Guide",
            "translations": {
                "en": {
                    "question_text": "Should I test before malaria drugs?",
                    "answer_text": "Get a confirmed rapid diagnostic test before starting ACT.",
                    "samples": ["test before malaria medicine"],
                },
                "yo": {
                    "question_text": "Se o ye ki n se ayewo iba?",
                    "answer_text": "Se ayewo RDT ki o to lo ogun iba.",
                    "samples": ["ayewo iba rdt"],
                },
                "ig": {
                    "question_text": "M ga-eme nnwale iba?",
                    "answer_text": "Mee nnwale obara RDT tupu i nuo ogwu iba.",
                    "samples": ["nnwale iba rdt"],
                },
            },
        },
    )
    assert r_edit.status_code == 200

    # Editor CANNOT clinically approve, language approve, or publish
    assert (
        client.post(
            f"/api/admin/translations/{en_tr.id}/clinical-review",
            headers={"X-CSRF-Token": csrf},
            json={"approved": True},
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/api/admin/translations/{en_tr.id}/publish",
            headers={"X-CSRF-Token": csrf},
        ).status_code
        == 403
    )

    # 2. Language reviewer CANNOT approve before clinical approval
    csrf_lang = _login_as(client, "language@healthyarn.ng", "HealthYarnLang2026!")
    r_early_lang = client.post(
        f"/api/admin/translations/{yo_tr.id}/language-review",
        headers={"X-CSRF-Token": csrf_lang},
        json={"approved": True},
    )
    assert r_early_lang.status_code == 400

    # 3. Clinical reviewer approves English source
    csrf_clin = _login_as(client, "clinical@healthyarn.ng", "HealthYarnClinic2026!")
    r_clin = client.post(
        f"/api/admin/translations/{en_tr.id}/clinical-review",
        headers={"X-CSRF-Token": csrf_clin},
        json={"approved": True, "comment": "Clinically verified"},
    )
    assert r_clin.status_code == 200
    assert r_clin.json()["status"] == "clinical_ok"

    # Clinical reviewer CANNOT publish
    assert (
        client.post(
            f"/api/admin/translations/{en_tr.id}/publish",
            headers={"X-CSRF-Token": csrf_clin},
        ).status_code
        == 403
    )

    # 4. Language reviewer can now approve English and Yoruba
    csrf_lang = _login_as(client, "language@healthyarn.ng", "HealthYarnLang2026!")
    r_lang = client.post(
        f"/api/admin/translations/{yo_tr.id}/language-review",
        headers={"X-CSRF-Token": csrf_lang},
        json={"approved": True, "comment": "Natural Yoruba phrasing"},
    )
    assert r_lang.status_code == 200
    assert r_lang.json()["status"] == "language_ok"

    # 5. Admin publishes language_ok non-placeholder translation
    csrf_adm = _login_as(client, "admin@healthyarn.ng", "HealthYarnAdmin2026!")
    r_pub = client.post(
        f"/api/admin/translations/{yo_tr.id}/publish",
        headers={"X-CSRF-Token": csrf_adm},
    )
    assert r_pub.status_code == 200
    assert r_pub.json()["status"] == "published"

    # 6. Admin CANNOT publish a translation that still contains placeholder prefix!
    placeholder_tr = seeded_session.exec(
        select(Translation).where(Translation.faq_id == 2, Translation.lang == "en")
    ).first()
    assert placeholder_tr is not None
    r_pub_placeholder = client.post(
        f"/api/admin/translations/{placeholder_tr.id}/publish",
        headers={"X-CSRF-Token": csrf_adm},
    )
    assert r_pub_placeholder.status_code == 400

    # Audit trail recorded the actions
    audits = seeded_session.exec(select(AuditLog)).all()
    actions = {a.action for a in audits}
    assert {"edit_reset_draft", "clinical_approve", "language_approve", "publish"}.issubset(actions)
