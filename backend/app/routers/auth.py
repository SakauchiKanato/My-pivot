"""
認証API

- POST /api/auth/register  新規登録
- POST /api/auth/login     ログイン → JWT
- GET  /api/auth/me        プロフィール
- GET  /api/auth/google/login  Google OAuth(未実装: 501)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.database import get_session
from app.models import User
from app.auth.jwt_provider import hash_password, verify_password
from app.auth.deps import get_current_user, get_provider

router = APIRouter(prefix="/api/auth", tags=["auth"])


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


@router.get("/google/login")
def google_login():
    """Google OAuth への入口。auth/google_provider.py の手順で実装後に有効化。"""
    raise HTTPException(
        status_code=501,
        detail="Google ログインは未実装です。app/auth/google_provider.py の手順を参照。",
    )
