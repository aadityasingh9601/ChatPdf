import numpy as np

# Reducing dimensions of embeddings using Matryoshka Representation Learning (MRL)
def truncate_embedding(embedding, target_dim=768):
    truncated = embedding[:target_dim]
    # Normalize after truncation
    norm = np.linalg.norm(truncated)
    return [v / norm for v in truncated]