"""Authentication, bcrypt password hashing, JWT cookies, CSRF verification, and RBAC dependencies."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Callable

import bcrypt
import jwt
from fastapi import Cookie, Depends, Header, HTTPException, Request, Response, status
from sqlmodel import Session, select

from app.config import get_settings
from app.db import get_session
from app.models import AuditLog, User

SESSION_COOKIE_NAME = "healthyarn_session"
CSRF_COOKIE_NAME = "healthyarn_csrf"


def validate_password_strength(password: str) -> None:
    if len(password) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 10 characters long.",
        )


def hash_password(password: str) -> str:
    validate_password_strength(password)
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user: User) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    exp = now + timedelta(hours=settings.JWT_EXPIRES_HOURS)
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session.",
        ) from exc


def set_auth_cookies(response: Response, token: str) -> str:
    settings = get_settings()
    max_age = settings.JWT_EXPIRES_HOURS * 3600
    csrf_token = secrets.token_urlsafe(24)

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=max_age,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=csrf_token,
        max_age=max_age,
        httponly=False,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        path="/",
    )
    return csrf_token


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    response.delete_cookie(key=CSRF_COOKIE_NAME, path="/")


def verify_csrf(
    request: Request,
    csrf_cookie: str | None = Cookie(default=None, alias=CSRF_COOKIE_NAME),
    csrf_header: str | None = Header(default=None, alias="X-CSRF-Token"),
) -> None:
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        if not csrf_cookie or not csrf_header or not secrets.compare_digest(csrf_cookie, csrf_header):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token missing or invalid.",
            )


def get_current_user(
    session_cookie: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
    session: Session = Depends(get_session),
) -> User:
    if not session_cookie:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    payload = decode_access_token(session_cookie)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject.")
    user = session.exec(select(User).where(User.id == int(user_id), User.is_active == True)).first()  # noqa: E712
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account inactive.")
    return user


def require_role(*allowed_roles: str) -> Callable[..., User]:
    def _dep(
        request: Request,
        user: User = Depends(get_current_user),
        csrf_cookie: str | None = Cookie(default=None, alias=CSRF_COOKIE_NAME),
        csrf_header: str | None = Header(default=None, alias="X-CSRF-Token"),
    ) -> User:
        verify_csrf(request, csrf_cookie=csrf_cookie, csrf_header=csrf_header)
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' is not permitted for this action.",
            )
        return user

    return _dep


def record_audit(
    session: Session,
    *,
    user_id: int,
    action: str,
    entity: str,
    entity_id: int,
    details: str | None = None,
) -> None:
    session.add(
        AuditLog(
            user_id=user_id,
            action=action,
            entity=entity,
            entity_id=entity_id,
            details=details,
        )
    )
