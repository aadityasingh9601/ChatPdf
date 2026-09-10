from llama_index.readers.file import PDFReader
from llama_index.core.node_parser import SentenceSplitter
from app.embeddings import embed_model
from llama_index.vector_stores.supabase import SupabaseVectorStore
import os
import gc
from dotenv import load_dotenv
load_dotenv()

# How many chunk embeddings to hold in memory at once before writing to pgvector.
# Keeps peak RAM bounded regardless of PDF size. 20 == embed model batch size, so
# each pgvector write corresponds to exactly one API call.
EMBED_BATCH_SIZE = 20


def _stream_embed_and_store(nodes, vector_store):
    """Embed a list of nodes in bounded batches and upsert each batch to pgvector.

    Gemini's embedding API rejects empty content (400 INVALID_ARGUMENT
    'EmbedContentRequest.content contains an empty Part'), so empty / whitespace
    only chunks are filtered out before embedding.
    """
    nonempty = [n for n in nodes if n.get_content() and n.get_content().strip()]
    if not nonempty:
        del nodes
        gc.collect()
        return 0

    contents = [n.get_content() for n in nonempty]
    embeddings = embed_model.get_text_embedding_batch(contents)

    for node, embedding in zip(nonempty, embeddings):
        node.embedding = embedding

    vector_store.add(nonempty)

    count = len(nonempty)
    del contents, embeddings, nonempty, nodes
    gc.collect()
    return count


def buildIndex(file_path: str, userId: str, pdfId: str):
    # Parse ONLY the specific uploaded file. Never scan a shared directory so we
    # avoid cross-contamination between concurrent uploads and repeated in-memory
    # copies of unrelated PDFs. load_data() returns one Document per page.
    metadata = {"user_id": userId, "pdf_id": pdfId}
    documents = PDFReader().load_data(file_path, extra_info=metadata)

    text_splitter = SentenceSplitter(chunk_size=512, chunk_overlap=50)
    vector_store = SupabaseVectorStore(
        postgres_connection_string=os.getenv("DATABASE_URL"),
        collection_name="embeddings",
        dimension=768
    )

    # Stream chunks to pgvector in bounded batches instead of building the whole
    # VertorStoreIndex (docs + nodes + all embeddings + index graph) in RAM at once.
    # We process page-by-page: each page's chunks are embedded in EMBED_BATCH_SIZE
    # groups and immediately flushed, so peak memory stays constant even for big PDFs.
    pending: list = []
    total = 0
    for doc in documents:
        nodes = text_splitter.get_nodes_from_documents([doc])
        for node in nodes:
            # Skip empty/whitespace-only chunks (scanned or image-only pages).
            if not node.get_content() or not node.get_content().strip():
                continue
            pending.append(node)
            if len(pending) >= EMBED_BATCH_SIZE:
                total += _stream_embed_and_store(pending, vector_store)
                pending = []
        del nodes, doc
        gc.collect()

    # Flush any remaining partial batch.
    if pending:
        total += _stream_embed_and_store(pending, vector_store)
        pending = []

    del documents
    gc.collect()
    return total


if __name__ == "__main__":
    buildIndex()