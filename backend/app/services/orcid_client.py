import httpx
import os
from typing import Optional

class ORCIDClient:
    
    TOKEN_URL = "https://sandbox.orcid.org/oauth/token"
    BASE_URL = "https://pub.sandbox.orcid.org/v3.0"

    # TOKEN_URL = "https://orcid.org/oauth/token"
    # BASE_URL = "https://pub.orcid.org/v3.0"

    def __init__(self):
        self.client_id = os.getenv("ORCID_CLIENT_ID")
        self.client_secret = os.getenv("ORCID_CLIENT_SECRET")
        self._token_cache: Optional[str] = None

    # ---------------------------------------------------------
    # 1. Obtener token público
    # ---------------------------------------------------------
    def get_public_token(self) -> str:
        """
        Obtiene un token público de ORCID (scope: /read-public).
        Se cachea en memoria para evitar pedirlo cada vez.
        """
        if self._token_cache:
            return self._token_cache

        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "client_credentials",
            "scope": "/read-public"
        }

        with httpx.Client(timeout=20.0) as client:
            response = client.post(self.TOKEN_URL, data=data)
            response.raise_for_status()
            token = response.json()["access_token"]
            self._token_cache = token
            return token

    # ---------------------------------------------------------
    # Headers comunes
    # ---------------------------------------------------------
    def _headers(self):
        token = self.get_public_token()
        return {
            "Accept": "application/json",
            "Authorization": f"Bearer {token}"
        }

    # ---------------------------------------------------------
    # 2. Consultar /record
    # ---------------------------------------------------------
    def fetch_record(self, orcid_id: str) -> dict:
        url = f"{self.BASE_URL}/{orcid_id}/record"
        with httpx.Client(timeout=20.0) as client:
            response = client.get(url, headers=self._headers())
            response.raise_for_status()
            return response.json()

    # ---------------------------------------------------------
    # 3. Consultar /works
    # ---------------------------------------------------------
    def fetch_works(self, orcid_id: str) -> dict:
        url = f"{self.BASE_URL}/{orcid_id}/works"
        with httpx.Client(timeout=20.0) as client:
            response = client.get(url, headers=self._headers())
            response.raise_for_status()
            return response.json()
