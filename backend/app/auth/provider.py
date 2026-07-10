"""
認証プロバイダの抽象インターフェース

現在は JWT(メール+パスワード)実装のみ。
Google OAuth へ移行する際は google_provider.py の GoogleAuthProvider を
実装し、settings.AUTH_PROVIDER = "google" に切り替える。
ルーターやフロントの get_current_user 依存部分は変更不要。
"""
from abc import ABC, abstractmethod
from typing import Optional

from sqlmodel import Session

from app.models import User


class AuthProvider(ABC):
    """トークンの発行と検証を担う共通インターフェース。"""

    @abstractmethod
    def create_token(self, user: User) -> str:
        """ユーザーに対するアクセストークンを発行する。"""
        ...

    @abstractmethod
    def resolve_user(self, token: str, session: Session) -> Optional[User]:
        """トークンからユーザーを解決する。無効なら None。"""
        ...
