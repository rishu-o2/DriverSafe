from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
import os
from typing import Dict, Any

router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# In-memory fake users database
fake_users_db: Dict[str, Any] = {}

class SignupRequest(BaseModel):
    username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6)

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

def create_access_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode, 
        os.getenv("SECRET_KEY", "driversafe_secret_key_2026_rishu"), 
        algorithm=os.getenv("ALGORITHM", "HS256")
    )
    return encoded_jwt

@router.post("/signup", response_model=TokenResponse)
async def signup(user: SignupRequest):
    if user.username in fake_users_db:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = pwd_context.hash(user.password)
    fake_users_db[user.username] = {
        "username": user.username,
        "hashed_password": hashed_password
    }
    
    access_token_expires = timedelta(minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")))
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login", response_model=TokenResponse)
async def login(user: LoginRequest):
    db_user = fake_users_db.get(user.username)
    if not db_user or not pwd_context.verify(user.password, db_user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    access_token_expires = timedelta(minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")))
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me")
async def read_users_me():
    return {"status": "authenticated", "message": "User is authenticated"}
