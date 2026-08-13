import os
from supabase import create_client, Client
from dotenv import load_dotenv, dotenv_values
from fastapi import Header, HTTPException, Depends

load_dotenv() # Loading variables from dotenv file.

url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_KEY")

def get_authenticated_supabase(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token")
    token = authorization.replace("Bearer ", "")
    client: Client = create_client(url,key)
    client.postgrest.auth(token)
    return client