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
        self.provider = "local"
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

    async def upload_file(self, file: UploadFile, folder: str = "general") -> str:
        """Atomic transfer of binary data to the cloud."""
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
                # Fallback to local (Scrubbed in Production for Security Audit)
                local_dir = f"backend/static/uploads/{folder}"
                os.makedirs(local_dir, exist_ok=True)
                local_path = f"{local_dir}/{safe_name}"
                with open(local_path, "wb") as f:
                    f.write(file_content)
                return f"static/uploads/{folder}/{safe_name}"
        finally:
            await file.seek(0)

storage_service = StorageService()
