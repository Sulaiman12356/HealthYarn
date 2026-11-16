"""CLI utility to create the first HealthYarn admin account.

Usage:
  python -m app.create_admin --name "Admin User" --email "admin@healthyarn.ng" --password "StrongPassword123!"
"""

from __future__ import annotations

import argparse
import getpass
import sys

from sqlmodel import Session, select

from app.auth import hash_password
from app.db import engine, init_db
from app.models import User


def create_admin_account(name: str, email: str, password: str) -> User:
    if len(password) < 10:
        raise ValueError("Password must be at least 10 characters long.")

    init_db(engine)
    with Session(engine) as session:
        existing = session.exec(select(User).where(User.email == email.strip().lower())).first()
        if existing:
            raise ValueError(f"A user with email {email} already exists.")
        user = User(
            name=name.strip(),
            email=email.strip().lower(),
            password_hash=hash_password(password),
            role="admin",
            is_active=True,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user


def main() -> None:
    parser = argparse.ArgumentParser(description="Create an admin user for HealthYarn.")
    parser.add_argument("--name", default=None)
    parser.add_argument("--email", default=None)
    parser.add_argument("--password", default=None)
    args = parser.parse_args()

    name = args.name or input("Admin full name: ").strip()
    email = args.email or input("Admin email: ").strip()
    password = args.password or getpass.getpass("Password (min 10 chars): ")

    try:
        user = create_admin_account(name, email, password)
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    print(f"Created admin account: id={user.id}, email={user.email}")


if __name__ == "__main__":
    main()
