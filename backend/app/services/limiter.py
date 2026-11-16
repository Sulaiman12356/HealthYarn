"""Shared in-memory rate limiter (never persists IP addresses to DB or logs)."""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
