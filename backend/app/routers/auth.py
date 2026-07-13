"""
認証API

- POST /api/auth/register  新規登録(メール+パスワード。UIからは非表示・API自体は維持)
- POST /api/auth/login     ログイン → JWT
- GET  /api/auth/me        プロフィール
- POST /api/auth/google    Googleログイン(Firebase AuthenticationのIDトークンを検証)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from pydantic import BaseModel
from sqlmodel import Session, select

from app import settings
from app.database import get_session
from app.models import User
from app.auth.jwt_provider import hash_password, verify_password
from app.auth.deps import get_current_user, get_provider

router = APIRouter(prefix="/api/auth", tags=["auth"])
_google_request = google_requests.Request()


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    user_id: int


class UserResponse(BaseModel):
    id: int
    username: str
    email: str


class GoogleLoginRequest(BaseModel):
    id_token: str


def _unique_username(base: str, session: Session) -> str:
    candidate = base or "user"
    n = 0
    while session.exec(select(User).where(User.username == candidate)).first():
        n += 1
        candidate = f"{base}{n}"
    return candidate


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, session: Session = Depends(get_session)):
    if session.exec(select(User).where(User.email == data.email)).first():
        raise HTTPException(400, "このメールアドレスはすでに使われています")
    if session.exec(select(User).where(User.username == data.username)).first():
        raise HTTPException(400, "このユーザー名はすでに使われています")
    if len(data.password) < 6:
        raise HTTPException(400, "パスワードは6文字以上にしてください")

    user = User(
        username=data.username,
        email=data.email,
        hashed_password=hash_password(data.password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    token = get_provider().create_token(user)
    return TokenResponse(access_token=token, username=user.username, user_id=user.id)


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == data.email)).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(401, "メールアドレスまたはパスワードが間違っています")
    token = get_provider().create_token(user)
    return TokenResponse(access_token=token, username=user.username, user_id=user.id)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id, username=current_user.username, email=current_user.email
    )


@router.post("/google", response_model=TokenResponse)
def google_login(data: GoogleLoginRequest, session: Session = Depends(get_session)):
    """Firebase Authentication(Googleサインイン)で取得したIDトークンを検証し、
    対応するユーザーを取得または新規作成して自前JWTを発行する。"""
    try:
        claims = google_id_token.verify_firebase_token(
            data.id_token, _google_request, audience=settings.FIREBASE_PROJECT_ID
        )
    except ValueError:
        raise HTTPException(401, "Googleトークンが無効です")

    email = claims.get("email")
    if not email:
        raise HTTPException(401, "Googleアカウントのメールアドレスを取得できませんでした")

    user = session.exec(select(User).where(User.email == email)).first()
    if user is None:
        base_username = (claims.get("name") or email.split("@")[0]).replace(" ", "_")
        user = User(
            username=_unique_username(base_username, session),
            email=email,
            hashed_password="",
            auth_provider="google",
        )
        session.add(user)
        session.commit()
        session.refresh(user)

    token = get_provider().create_token(user)
    return TokenResponse(access_token=token, username=user.username, user_id=user.id)
