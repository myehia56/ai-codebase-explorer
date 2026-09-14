import os
import httpx
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.domain.models import User

router = APIRouter(prefix="/auth", tags=["auth"])

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")
JWT_SECRET = os.getenv("JWT_SECRET", "super_secret_key_change_this_later_in_production")
FRONTEND_URL = os.getenv("FRONTEND_URL")

@router.get("/github")
def github_login():
    # Step 1: Redirect user to GitHub's consent screen
    github_auth_url = f"https://github.com/login/oauth/authorize?client_id={GITHUB_CLIENT_ID}&scope=repo,read:user"
    return RedirectResponse(github_auth_url)

@router.get("/callback")
async def github_callback(code: str = Query(...), db: Session = Depends(get_db)):
    # Step 2: GitHub sends a 'code'. We exchange it for an access token.
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code
            }
        )
        token_data = token_response.json()
        access_token = token_data.get("access_token")

        if not access_token:
            raise HTTPException(status_code=400, detail="Failed to get access token from GitHub")

        # Step 3: Fetch the user's GitHub profile
        user_response = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github.v3+json"
            }
        )
        github_user = user_response.json()

    # Step 4: Save or update the user in our PostgreSQL database
    github_id = str(github_user["id"])
    username = github_user["login"]
    avatar_url = github_user.get("avatar_url", "")

    user = db.query(User).filter(User.github_id == github_id).first()
    if not user:
        user = User(
            github_id=github_id,
            username=username,
            avatar_url=avatar_url,
            access_token=access_token 
        )
        db.add(user)
    else:
        user.username = username
        user.avatar_url = avatar_url
        user.access_token = access_token
    
    db.commit()
    db.refresh(user)

    # Step 5: Create a JWT so our Next.js frontend knows who is logged in
    jwt_payload = {
        "sub": str(user.id),
        "username": user.username,
        "exp": datetime.now(timezone.utc) + timedelta(days=7)
    }
    token = jwt.encode(jwt_payload, JWT_SECRET, algorithm="HS256")

    # Step 6: Redirect back to the frontend with the token
    return RedirectResponse(f"{FRONTEND_URL}/login/success?token={token}")