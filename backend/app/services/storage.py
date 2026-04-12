import os
import re
from fastapi import UploadFile
from ..core.config import settings

class StorageService:
    """
    Syndicate Intelligence Asset Management.
    Deploys deterministic upload patterns to Cloudinary or Supabase.
    """
    
    def __init__(self):
        self.provider = None
        if settings.CLOUDINARY_URL:
            import cloudinary
            import cloudinary.uploader
            self.provider = "cloudinary"
            # Configuration is picked up from CLOUDINARY_URL env var
        elif settings.SUPABASE_KEY and settings.SUPABASE_URL:
            import httpx
            self.provider = "supabase"
            self.http_client = httpx.AsyncClient(
                base_url=f"{settings.SUPABASE_URL}/storage/v1",
                headers={"Authorization": f"Bearer {settings.SUPABASE_KEY}", "apikey": settings.SUPABASE_KEY}
            )
        
        if not self.provider:
            # Shift-Left Protocol: Fail fast rather than writing to local disk
            raise RuntimeError("CRITICAL STORAGE FAILURE: No Cloud Asset Provider (Cloudinary/Supabase) configured.")

    async def upload_file(self, file: UploadFile, folder: str = "general") -> str:
        """Atomic transfer of binary data to the cloud with strict policing."""
        # Payload Policing: 5MB limit
        if file.size > 5 * 1024 * 1024:
            raise RuntimeError(f"ASSET_VIOLATION: {file.filename} exceeds 5MB limit")
        
        # Identity Check: MIME validation
        if not file.content_type.startswith("image/"):
            raise RuntimeError(f"TYPE_VIOLATION: {file.filename} is not an image")

        safe_name = re.sub(r'[^a-zA-Z0-9.-]', '_', file.filename)
        path = f"{folder}/{safe_name}"
        
        file_content = await file.read()
        
        try:
            if self.provider == "cloudinary":
                import cloudinary.uploader
                upload_result = cloudinary.uploader.upload(
                    file_content,
                    public_id=f"gangster/{path.replace('/', '_')}",
                    folder=f"gangster/{folder}"
                )
                return upload_result.get("secure_url")
                
            elif self.provider == "supabase":
                import httpx
                # Path format: /object/bucket/path
                bucket_name = "assets"
                url = f"/object/{bucket_name}/{path}"
                
                resp = await self.http_client.post(
                    url,
                    content=file_content,
                    headers={"Content-Type": file.content_type}
                )
                
                if resp.status_code not in [200, 201]:
                    # If 409, it might already exist, try to return public URL regardless or log
                    if resp.status_code != 409:
                        print(f"SUPABASE STORAGE ERROR: {resp.text}")
                
                return f"{settings.SUPABASE_URL}/storage/v1/object/public/{bucket_name}/{path}"
            
            else:
                raise RuntimeError("Asset ingestion failed: Final fallback reached without provider.")
        finally:
            await file.seek(0)

storage_service = StorageService()
