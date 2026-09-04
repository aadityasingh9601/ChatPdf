from llama_index.core import (VectorStoreIndex, SimpleDirectoryReader, Document, StorageContext, Settings)
from llama_index.readers.file import PDFReader
from llama_index.core.node_parser import SentenceSplitter
from app.embeddings import embed_model
from llama_index.vector_stores.supabase import SupabaseVectorStore
import os
import gc
from dotenv import load_dotenv
from app.llm import llm
load_dotenv()

# Writable directory for temp PDF storage.
DATA_DIR = os.getenv("DATA_DIR", "/tmp/data")

def buildIndex(userId:str):
    # Process one PDF at a time to keep peak memory bounded on small instances.
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
    Settings.text_splitter = text_splitter
    Settings.embed_model = embed_model
    Settings.llm = llm

    vector_store = SupabaseVectorStore(
        postgres_connection_string=os.getenv("DATABASE_URL"),
        collection_name="embeddings",
        dimension=768
    )
    storage_context = StorageContext.from_defaults(vector_store=vector_store)

    # Build the index. This still holds docs + embeddings in RAM at once; the
    # big wins come from streaming chunks to pgvector so we can delete the temp
    # file sooner, and from running this off the event loop. See main.py.
    index = VectorStoreIndex.from_documents(
        documents, transformations=[text_splitter],
        storage_context=storage_context,
        show_progress=True
    )

    # Free the large in-memory structures before this process serves anything else.
    del documents
    gc.collect()
    return index
