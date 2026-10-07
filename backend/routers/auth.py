from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
from dotenv import load_dotenv
import os

load_dotenv()
router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
fake_users_db = {}

SECRET_KEY = os.getenv("SECRET_KEY", "driversafe_secret_key_2026_rishu")
ALGORITHM  = os.getenv("ALGORITHM", "HS256")
EXPIRE_MIN = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

class SignupRequest(BaseModel):
    username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6)
    name: str | None = None

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    name: str | None = None
    email: str | None = None

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    to_encode.update({"exp": datetime.utcnow() + expires_delta})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

@router.post("/signup", response_model=TokenResponse)
def signup(body: SignupRequest):
    if body.username in fake_users_db:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    name = body.name or body.username
    fake_users_db[body.username] = {
        "username": body.username,
        "hashed_password": hash_password(body.password),
        "name": name,
    }
    access_token = create_access_token({"sub": body.username, "name": name}, timedelta(minutes=EXPIRE_MIN))
    return {"access_token": access_token, "token_type": "bearer", "name": name}

@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest):
    db_user = fake_users_db.get(body.username)
    if not db_user or not verify_password(body.password, db_user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    name = db_user.get("name", body.username)
    access_token = create_access_token({"sub": body.username, "name": name}, timedelta(minutes=EXPIRE_MIN))
    return {"access_token": access_token, "token_type": "bearer", "name": name}

@router.get("/me")
def get_me():
    return {"message": "Auth working"}