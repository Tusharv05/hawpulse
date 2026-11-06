import os
import uuid
import base64
from typing import Tuple

class StorageService:
    def __init__(self):
        self.upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
        os.makedirs(self.upload_dir, exist_ok=True)

    async def save_uploaded_file(self, file_bytes: bytes, original_filename: str) -> str:
        """
        Saves document buffer and returns access URL.
        Compatible with local static serving, MinIO, or S3/Cloudflare R2.
        """
        ext = original_filename.split(".")[-1] if "." in original_filename else "webp"
        filename = f"{uuid.uuid4()}.{ext}"
        filepath = os.path.join(self.upload_dir, filename)
        
        with open(filepath, "wb") as f:
            f.write(file_bytes)
            
        # Return URL (or data URI if running in serverless environment)
        return f"/uploads/{filename}"

    def encode_image_base64(self, file_bytes: bytes, content_type: str = "image/jpeg") -> str:
        """Encodes image bytes to base64 data URI for vision models."""
        encoded = base64.b64encode(file_bytes).decode("utf-8")
        return f"data:{content_type};base64,{encoded}"

storage_service = StorageService()
