from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from passlib.context import CryptContext
from jose import jwt
from jose.exceptions import JWTError
from datetime import datetime, timedelta
from dotenv import load_dotenv
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
import os

from database import User, get_db
from utils.security import AUTH_COOKIE_DOMAIN, AUTH_COOKIE_SAMESITE, AUTH_COOKIE_SECURE

load_dotenv()
router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY or not SECRET_KEY.strip():
    raise RuntimeError("SECRET_KEY must be set to a non-empty value before starting the backend")
ALGORITHM  = os.getenv("ALGORITHM", "HS256")
EXPIRE_MIN = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

class SignupRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=320)
    password: str = Field(..., min_length=8)
    name: str | None = None

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    name: str | None = None
    username: str


COOKIE_NAME = "access_token"


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=EXPIRE_MIN * 60,
        httponly=True,
        secure=AUTH_COOKIE_SECURE,
        samesite=AUTH_COOKIE_SAMESITE,
        domain=AUTH_COOKIE_DOMAIN,
        path="/",
    )


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


def get_current_user(
    token: str | None = Cookie(default=None, alias=COOKIE_NAME),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_access_token(token) if token else None
    username = payload.get("sub") if payload else None
    user = db.query(User).filter(User.username == username).first() if username else None
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return user

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    to_encode.update({"exp": datetime.utcnow() + expires_delta})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

@router.post("/signup", response_model=TokenResponse)
def signup(body: SignupRequest, response: Response, db: Session = Depends(get_db)):
    name = body.name or body.username
    user = User(username=body.username, password_hash=hash_password(body.password), name=name)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to create account with supplied details",
        )
    access_token = create_access_token({"sub": body.username, "name": name}, timedelta(minutes=EXPIRE_MIN))
    set_auth_cookie(response, access_token)
    return {"username": body.username, "name": name}

@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == body.username).first()
    if not db_user or not verify_password(body.password, db_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    name = db_user.name or db_user.username
    access_token = create_access_token({"sub": body.username, "name": name}, timedelta(minutes=EXPIRE_MIN))
    set_auth_cookie(response, access_token)
    return {"username": db_user.username, "name": name}

@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, user: User = Depends(get_current_user)):
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        httponly=True,
        secure=AUTH_COOKIE_SECURE,
        samesite=AUTH_COOKIE_SAMESITE,
        domain=AUTH_COOKIE_DOMAIN,
    )


@router.get("/me")
def get_me(user: User = Depends(get_current_user)):
    return {"username": user.username, "name": user.name}
