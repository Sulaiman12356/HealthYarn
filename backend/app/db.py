"""Database engine and session helpers."""

from typing import Generator

from sqlmodel import Session, SQLModel, create_engine

from app.config import get_settings


def build_engine(database_url: str | None = None):
    url = database_url or get_settings().DATABASE_URL
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, echo=False, connect_args=connect_args)


engine = build_engine()


def init_db(target_engine=None) -> None:
    SQLModel.metadata.create_all(target_engine or engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
