from llama_index.core import (VectorStoreIndex, SimpleDirectoryReader, Document, StorageContext, Settings)
from llama_index.readers.file import PDFReader
from llama_index.core.node_parser import SentenceSplitter
from app.embeddings import embed_model
from llama_index.vector_stores.supabase import SupabaseVectorStore
import textwrap
import os
from dotenv import load_dotenv, dotenv_values
from app.llm import llm

# Writable directory for temp PDF storage.
DATA_DIR = os.getenv("DATA_DIR", "/tmp/data")

def buildIndex(userId:str):
    # Loading the documents.
    parser = PDFReader()
    file_extractor = {".pdf": parser}
    documents = SimpleDirectoryReader(
        DATA_DIR, file_extractor=file_extractor, file_metadata=lambda file_path: {
        "user_id": userId,
        "file_path": file_path
    }
    ).load_data()

    # Transformations -> Chunking, extracting meta-data & embed each chunk.
    text_splitter = SentenceSplitter(chunk_size=512, chunk_overlap=50)
    # Set the text_splitter & embedding model globally.
    Settings.text_splitter = text_splitter
    Settings.embed_model = embed_model
    Settings.llm = llm
    # With your text indexed, it is now technically ready for querying! However, embedding all your text again can be 
    # time-consuming and, if you are using a hosted LLM, it can also be expensive. To save time and money you will 
    # want to STORE YOUR EMBEDDINGS FIRST.

    # Storing the embeddings.
    # Create vector store.
    vector_store = SupabaseVectorStore(
        postgres_connection_string=(
            os.getenv("DATABASE_URL")
        ),
        collection_name="embeddings",
        dimension=768
    )
    # Whatever model you chose, look up its dimension and pass that exact number.
    # The number must match exactly. If your model outputs 768 dimensions but your pgvector column is set to 1536, 
    # it will throw an error on insert.
    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    # per-index
    index = VectorStoreIndex.from_documents(
        documents, transformations=[text_splitter],
        storage_context=storage_context,
        show_progress = True
    )
    return index


if __name__ == "__main__":
    buildIndex()