from fastapi import FastAPI, File, UploadFile, Body, Form, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from app.db import supabase
import os
import shutil
import io
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

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB per file
MAX_TOTAL_SIZE = 20 * 1024 * 1024  # 20MB combined across all user PDFs
MAX_PDF_PAGES = 50  # max pages per PDF

# Writable directory for temp PDF storage. On Vercel serverless only /tmp is
# writable (the project dir is read-only). Override with DATA_DIR if needed.
DATA_DIR = os.getenv("DATA_DIR", "/tmp/data")

def countPdfPages(contents: bytes) -> int:
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(contents))
    return len(reader.pages)

def getUserTotalSize(userId: str) -> int:
    response = supabase.table("documents").select("file_size").eq("user_id", userId).execute()
    rows = response.data if response.data else []
    return sum(row.get("file_size") or 0 for row in rows)

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
async def upload_file(userId:str,file: UploadFile = File(...), authorization: str = Header(...)):
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File size exceeds 5MB limit")
    if len(contents) == 0:
        raise HTTPException(status_code=422, detail="File is empty")
    try:
        page_count = countPdfPages(contents)
    except Exception:
        raise HTTPException(status_code=422, detail="Could not read PDF file")
    if page_count > MAX_PDF_PAGES:
        raise HTTPException(status_code=413, detail=f"PDF has {page_count} pages; limit is {MAX_PDF_PAGES} pages")
    total_size = getUserTotalSize(userId)
    if total_size + len(contents) > MAX_TOTAL_SIZE:
        raise HTTPException(status_code=413, detail="Total size of all PDFs would exceed the 20MB limit")
    file.file.seek(0)
    saveFile(file)
    buildIndex(userId)
    # Extract token
    token = authorization.replace("Bearer ", "")
    # Add user's token to supabase client
    supabase.postgrest.auth(token)
    # Save the document in documents table.
    res = supabase.table("documents").insert({ "user_id": userId, "file_name": file.filename, "file_size": len(contents) }).execute()
    removeFile(os.path.join(DATA_DIR, file.filename))
    row = res.data[0] if res.data else {}
    print(row)
    return {
        "filename": row["file_name"],
        "content_type": file.content_type,
        "id": row["id"],
        "file_size": row["file_size"],
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
    response = supabase.table("documents").select("id,file_name,file_size").eq("user_id",userId).execute()
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
def getChatMessages(chatId:str, authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    supabase.postgrest.auth(token)
    response = supabase.table("messages").select("role,content,created_at").eq("document_id",chatId).execute()
    return response

@app.post("/api/chat")
async def addChatMessage(messageData: Message = Body(...), authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    supabase.postgrest.auth(token)
    response = supabase.table("messages").insert(messageData.model_dump()).execute()
    return response