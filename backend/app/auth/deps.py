"""
FastAPI 依存注入: get_current_user

プロバイダは settings.AUTH_PROVIDER で選択される。
ルーター側はこの関数だけに依存するため、認証方式の変更が波及しない。
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session

from app import settings
from app.database import get_session
from app.models import User
from app.auth.provider import AuthProvider
from app.auth.jwt_provider import JwtAuthProvider
from app.auth.google_provider import GoogleAuthProvider

bearer_scheme = HTTPBearer()

_PROVIDERS = {
    "jwt": JwtAuthProvider,
    "google": GoogleAuthProvider,
}


def get_provider() -> AuthProvider:
    cls = _PROVIDERS.get(settings.AUTH_PROVIDER, JwtAuthProvider)
    return cls()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    session: Session = Depends(get_session),
) -> User:
    provider = get_provider()
    user = provider.resolve_user(credentials.credentials, session)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="トークンが無効または期限切れです",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
