"""
認証関連のAPI

エンドポイント：
- POST /api/auth/register  新規ユーザー登録
- POST /api/auth/login     ログイン → JWTを返す
- GET  /api/auth/me        自分のプロフィール取得（要認証）
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlmodel import Session, select

from app.database import get_session
from app.models import User
from app.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


# --- リクエスト/レスポンスの形 ---
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


# --- 新規登録 ---
@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, session: Session = Depends(get_session)):
    # メールアドレス重複チェック
    existing_email = session.exec(select(User).where(User.email == data.email)).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="このメールアドレスはすでに使われています",
        )
    # ユーザー名重複チェック
    existing_username = session.exec(
        select(User).where(User.username == data.username)
    ).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="このユーザー名はすでに使われています",
        )
    # パスワード長チェック
    if len(data.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="パスワードは6文字以上にしてください",
        )

    user = User(
        username=data.username,
        email=data.email,
        hashed_password=hash_password(data.password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    token = create_access_token(user_id=user.id, username=user.username)
    return TokenResponse(
        access_token=token,
        username=user.username,
        user_id=user.id,
    )


# --- ログイン ---
@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == data.email)).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="メールアドレスまたはパスワードが間違っています",
        )

    token = create_access_token(user_id=user.id, username=user.username)
    return TokenResponse(
        access_token=token,
        username=user.username,
        user_id=user.id,
    )


# --- 自分のプロフィール取得 ---
@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
    )
