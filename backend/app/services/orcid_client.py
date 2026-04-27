import os
from typing import Optional

import httpx

TOKEN_URL_SANDBOX = "https://sandbox.orcid.org/oauth/token"
BASE_URL_SANDBOX = "https://pub.sandbox.orcid.org/v3.0"

# Si en algún momento pasas a producción, cambiarías a:
# TOKEN_URL_PROD = "https://orcid.org/oauth/token"
# BASE_URL_PROD = "https://pub.orcid.org/v3.0"


class ORCIDClient:
    def __init__(self):
        self.client_id = os.getenv("ORCID_CLIENT_ID")
        self.client_secret = os.getenv("ORCID_CLIENT_SECRET")
        self._token_cache: Optional[str] = None
        self.token_url = TOKEN_URL_SANDBOX
        self.base_url = BASE_URL_SANDBOX

    # ---------------------------------------------------------
    # 1. Obtener token público
    # ---------------------------------------------------------
    def get_public_token(self) -> str:
        if self._token_cache:
            return self._token_cache

        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "client_credentials",
            "scope": "/read-public",
        }

        with httpx.Client(timeout=20.0) as client:
            response = client.post(self.token_url, data=data)
            response.raise_for_status()
            token = response.json()["access_token"]
            self._token_cache = token
            return token

    # ---------------------------------------------------------
    # Headers comunes
    # ---------------------------------------------------------
    def _headers(self) -> dict:
        token = self.get_public_token()
        return {
            "Accept": "application/json",
            "Authorization": f"Bearer {token}",
        }

    # ---------------------------------------------------------
    # 2. Consultar /record
    # ---------------------------------------------------------
    def fetch_record(self, orcid_id: str) -> dict:
        url = f"{self.base_url}/{orcid_id}/record"
        with httpx.Client(timeout=20.0) as client:
            response = client.get(url, headers=self._headers())
            response.raise_for_status()
            return response.json()

    # ---------------------------------------------------------
    # 3. Consultar /works (summary)
    # ---------------------------------------------------------
    def fetch_works(self, orcid_id: str) -> dict:
        url = f"{self.base_url}/{orcid_id}/works"
        with httpx.Client(timeout=20.0) as client:
            response = client.get(url, headers=self._headers())
            response.raise_for_status()
            return response.json()

    # ---------------------------------------------------------
    # 4. Consultar /work/{put_code} (detalle)
    # ---------------------------------------------------------
    def fetch_work_detail(self, orcid_id: str, put_code: int) -> dict | None:
        url = f"{self.base_url}/{orcid_id}/work/{put_code}"
        with httpx.Client(timeout=20.0) as client:
            response = client.get(url, headers=self._headers())
            if response.status_code != 200:
                return None
            return response.json()


# -------------------------------------------------------------------
# Funciones de módulo usadas en researchers.py
# -------------------------------------------------------------------
def get_works_summary(orcid_id: str) -> dict:
    client = ORCIDClient()
    return client.fetch_works(orcid_id)


def get_work_detail(orcid_id: str, put_code: int) -> dict | None:
    client = ORCIDClient()
    return client.fetch_work_detail(orcid_id, put_code)
