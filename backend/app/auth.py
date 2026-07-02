from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import DEV_MODE, DEV_USER_ID
from .database import get_db
from .models import User
from .security import decode_access_token

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds:
        payload = decode_access_token(creds.credentials)
        if not payload or "sub" not in payload:
            raise HTTPException(status_code=401, detail="登录已失效，请重新登录")
        user = db.get(User, int(payload["sub"]))
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="账号不存在或已禁用")
        return user

    if DEV_MODE:
        user = db.get(User, DEV_USER_ID)
        if not user:
            raise HTTPException(status_code=500, detail="开发用户未初始化，请重启服务")
        return user

    raise HTTPException(status_code=401, detail="请先登录")


def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return user
