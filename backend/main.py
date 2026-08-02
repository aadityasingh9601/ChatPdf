from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from db import supabase
import os
import shutil
from query import answerUserQuery
from ingestion import buildIndex

class User(BaseModel):
    name: str | None = Field(default=None)
    email: str 
    password: str

class Message(BaseModel):
    user_id: int
    document_id: int
    content: str | None = Field(default=None)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

def saveFile(file: UploadFile = File(...)):
    # Create data directory if it doesn't exist
    os.makedirs("data", exist_ok=True)
    # Save file directly to data directory
    file_path = f"data/{file.filename}"
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
    print(userId)
    response = supabase.table("User").select("*").eq("id",4).execute()
    return response

# Create new user
@app.post("/user")
async def createUser(data:User):
    print(data)
    response = supabase.table("User").insert(data.model_dump()).execute()
    return response

# Upload pdf.
@app.post("/api/upload")
async def upload_file(userId:str,file: UploadFile = File(...)):
    print(userId)
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File size exceeds 5MB limit")
    file.file.seek(0)
    saveFile(file)
    buildIndex(userId)
    # Save the document in documents table.
    res = supabase.table("documents").insert({ "user_id": userId, "file_name": file.filename }).execute()
    print(res)
  
    removeFile(f"data/{file.filename}")
    return {
        "filename": file.filename,
        "content_type": file.content_type,
    }

# Ask query.
@app.get("/api/userquery")
def user_query(userId:str, pdfName:str, query: str):
    print(f"userId -> {userId}")
    print(f"user query -> {query}")
    print(f"pdfName -> {pdfName}")
    response = answerUserQuery(userId, pdfName, query)
    return {"answer": str(response)}

# Fetch all user's pdfs.
@app.get("/api/getpdfs")
def get_pdfs(userId:str, authorization: str = Header(...),):
    print(f"userId -> {userId}")
    # Extract token
    token = authorization.replace("Bearer ", "")
    # print(token)
    # Add user's token to supabase client
    supabase.postgrest.auth(token)
    response = supabase.table("documents").select("id,file_name").eq("user_id",userId).execute()
    print(response)
    return response

# Delete user's pdfs.
@app.delete("/api/pdf")
def delete_Pdf(pdfId:str, fileName:str, userId:str):
    print(f"pdfId -> {pdfId}")
    print(f"userId -> {userId}")
    print(fileName)
    # Delete embeddings from vector db.
    response1 = supabase.rpc("delete_embeddings", {
    "p_file_name": fileName,
    "p_user_id": userId
    }).execute()
    
    print(response1)
    # Delete records from normal db.
    response2 = supabase.table("documents").delete().eq("id",pdfId).execute()
    print(response2)
    return "pdf deleted successfully!"

# Fetch chat messages.
@app.get("/api/chat")
def getChatMessages(chatId:str):
    print(f"chatId -> {chatId}")
    response = supabase.table("messages").select("id,role,content").eq("document_id",chatId).execute()
    print(response)
    return response

@app.post("/api/chat")
async def addChatMessage(messageData: Message):
    print(messageData)
    # response = supabase.table("User").insert(data.model_dump()).execute()
    return "received on backend"