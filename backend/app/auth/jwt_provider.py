"""
JWT 認証プロバイダ(現行)

旧 auth.py の bcrypt + python-jose 実装を AuthProvider 準拠に移植。
"""
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from jose import JWTError, jwt
from sqlmodel import Session

from app import settings
from app.models import User
from app.auth.provider import AuthProvider


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    return bcrypt.checkpw(plain.encode(), hashed.encode())


class JwtAuthProvider(AuthProvider):
    def create_token(self, user: User) -> str:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        payload = {"sub": str(user.id), "username": user.username, "exp": expire}
        return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    def resolve_user(self, token: str, session: Session) -> Optional[User]:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        except JWTError:
            return None
        try:
            user_id = int(payload.get("sub", 0))
        except (TypeError, ValueError):
            return None
        return session.get(User, user_id)
