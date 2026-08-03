import os
from supabase import create_client, Client
from dotenv import load_dotenv, dotenv_values

load_dotenv() # Loading variables from dotenv file.

url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(url,key)