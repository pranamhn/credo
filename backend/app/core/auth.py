"""ENG-04 — JWT Auth + RBAC helpers."""
from __future__ import annotations
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.config import settings
from app.models.user import Role

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def require_role(*roles: Role):
    """Dependency factory: raise 403 if user role not in allowed roles."""
    def _check(token: str = Depends(oauth2_scheme)) -> dict:
        payload = decode_token(token)
        user_role = payload.get("role")
        if user_role not in [r.value for r in roles]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return payload
    return _check


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    return decode_token(token)
