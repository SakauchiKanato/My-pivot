"""
Google OAuth プロバイダ(スタブ)

将来 Gmail アカウントでのログインに移行する際の実装場所。

実装手順(参考: https://developers.google.com/identity/protocols/oauth2 、
FastAPI での実装例は https://docs.authlib.org/en/latest/client/fastapi.html ):
1. pip install authlib httpx
2. Google Cloud Console で OAuth クライアントID/シークレットを取得し、
   環境変数 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET に設定
3. routers/auth.py の /google/login /google/callback を有効化
   (コールバックで email を検証 → User を get-or-create → 自前JWTを発行)
4. settings.AUTH_PROVIDER = "google" に切替

方針: Google はあくまで「本人確認」に使い、セッションは現行の自前JWTを
継続発行する。これにより resolve_user 側(依存注入)は無変更で済む。
"""
from typing import Optional

from sqlmodel import Session

from app.models import User
from app.auth.provider import AuthProvider
from app.auth.jwt_provider import JwtAuthProvider


class GoogleAuthProvider(AuthProvider):
    """
    トークン発行/検証は JWT に委譲。
    Google はログインフロー(routers/auth.py 側)でのみ使う設計。
    """

    def __init__(self) -> None:
        self._jwt = JwtAuthProvider()

    def create_token(self, user: User) -> str:
        return self._jwt.create_token(user)

    def resolve_user(self, token: str, session: Session) -> Optional[User]:
        return self._jwt.resolve_user(token, session)
