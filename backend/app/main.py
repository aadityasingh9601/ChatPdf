from fastapi import FastAPI, File, UploadFile, Body, Form, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from app.db import supabase
import os
import shutil
from app.query import answerUserQuery
from app.ingestion import buildIndex
from dotenv import load_dotenv, dotenv_values

load_dotenv() # Loading variables from dotenv file.

frontend_url: str = os.getenv("FRONTEND_URL")

class User(BaseModel):
    name: str | None = Field(default=None)
    email: str 
    password: str

class Message(BaseModel):
    user_id: str
    document_id: str
    role: str
    content: str | None = Field(default=None)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

# Writable directory for temp PDF storage. On Vercel serverless only /tmp is
# writable (the project dir is read-only). Override with DATA_DIR if needed.
DATA_DIR = os.getenv("DATA_DIR", "/tmp/data")

def saveFile(file: UploadFile = File(...)):
    # Create data directory if it doesn't exist
    os.makedirs(DATA_DIR, exist_ok=True)
    # Save file directly to data directory
    file_path = os.path.join(DATA_DIR, file.filename)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

def removeFile(file_path:str):
    os.remove(file_path)

@app.get("/")
async def root():
    return {"message": "Hello World"}

# Get all users
@app.get("/users")
async def getAllUsersData():
    response = supabase.table("User").select("name email").execute()
    return response

# Get single user
@app.get("/user/{userId}")
async def getUserData(userId):
    response = supabase.table("User").select("*").eq("id",4).execute()
    return response

# Create new user
@app.post("/user")
async def createUser(data:User):
    response = supabase.table("User").insert(data.model_dump()).execute()
    return response

# Upload pdf.
@app.post("/api/upload")
async def upload_file(userId:str,file: UploadFile = File(...)):
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File size exceeds 5MB limit")
    file.file.seek(0)
    saveFile(file)
    buildIndex(userId)
    # Save the document in documents table.
    res = supabase.table("documents").insert({ "user_id": userId, "file_name": file.filename }).execute()
    removeFile(os.path.join(DATA_DIR, file.filename))
    return {
        "filename": file.filename,
        "content_type": file.content_type,
    }

# Ask query.
@app.get("/api/userquery")
def user_query(userId:str, pdfName:str, query: str):
    response = answerUserQuery(userId, pdfName, query)
    return {"answer": str(response)}

# Fetch all user's pdfs.
@app.get("/api/getpdfs")
def get_pdfs(userId:str, authorization: str = Header(...),):
    # Extract token
    token = authorization.replace("Bearer ", "")
    # Add user's token to supabase client
    supabase.postgrest.auth(token)
    response = supabase.table("documents").select("id,file_name").eq("user_id",userId).execute()
    return response

# Delete user's pdfs.
@app.delete("/api/pdf")
def delete_Pdf(pdfId:str, fileName:str, userId:str):
    # Delete embeddings from vector db.
    response1 = supabase.rpc("delete_embeddings", {
    "p_file_name": fileName,
    "p_user_id": userId
    }).execute()
    # Delete records from normal db.
    response2 = supabase.table("documents").delete().eq("id",pdfId).execute()
    return "pdf deleted successfully!"

# Fetch chat messages.
@app.get("/api/chat")
def getChatMessages(chatId:str):
    response = supabase.table("messages").select("role,content,created_at").eq("document_id",chatId).execute()
    return response

@app.post("/api/chat")
async def addChatMessage(messageData: Message = Body(...)):
    response = supabase.table("messages").insert(messageData.model_dump()).execute()
    return response