import os
import urllib.parse
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv
import httpx

TOKEN_URL_SANDBOX = "https://sandbox.orcid.org/oauth/token"
AUTHORIZATION_URL_SANDBOX = "https://sandbox.orcid.org/oauth/authorize"
BASE_URL_SANDBOX = "https://pub.sandbox.orcid.org/v3.0"

# Si en algún momento pasas a producción, cambiarías a:
# TOKEN_URL_PROD = "https://orcid.org/oauth/token"
# BASE_URL_PROD = "https://pub.orcid.org/v3.0"

# ---------------------------------------------------------
# Clase de cliente de ORCID
# ---------------------------------------------------------

class ORCIDClient:
    # ---------------------------------------------------------
    # Función auxiliar: inicializar el cliente de ORCID
    # ---------------------------------------------------------
    def __init__(self):
        # Asegura que al ejecutar `uvicorn` local también se carga `backend/.env`.
        # (En docker `ORCID_REDIRECT_URI` y secretos llegan por env_file, así que esto no molesta.)
        _env_path = Path(__file__).resolve().parents[2] / ".env"
        load_dotenv(dotenv_path=_env_path, override=False)

        self.client_id = os.getenv("ORCID_CLIENT_ID")
        self.client_secret = os.getenv("ORCID_CLIENT_SECRET")
        self._token_cache: Optional[str] = None
        self.token_url = TOKEN_URL_SANDBOX
        self.authorization_url = AUTHORIZATION_URL_SANDBOX
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

    # ---------------------------------------------------------
    # OAuth 3-legged (authorization code)
    # ---------------------------------------------------------
    def build_authorize_url(
        self,
        *,
        redirect_uri: str,
        scope: str = "/authenticate",
        state: str | None = None,
    ) -> str:
        """
        Creates the ORCID authorization URL (user signs in at ORCID and returns an auth code).
        """
        params: dict[str, Any] = {
            "client_id": self.client_id,
            "response_type": "code",
            # Scope(s) are space-separated in the authorize URL.
            "scope": scope,
            "redirect_uri": redirect_uri,
        }
        if state:
            params["state"] = state
        return f"{self.authorization_url}?{urllib.parse.urlencode(params)}"

    # ---------------------------------------------------------
    # Función auxiliar: intercambiar código de autorización
    # ---------------------------------------------------------

    def exchange_authorization_code(
        self,
        *,
        code: str,
        redirect_uri: str,
    ) -> dict:
        """
        Server-side code exchange. Response includes at least `orcid` and usually `name`.
        """
        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
        }
        with httpx.Client(timeout=20.0) as client:
            response = client.post(self.token_url, data=data, headers={"Accept": "application/json"})
            response.raise_for_status()
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


def get_record(orcid_id: str) -> dict:
    client = ORCIDClient()
    return client.fetch_record(orcid_id)


def extract_display_name(record: dict | None) -> str | None:
    """
    Devuelve un nombre legible a partir de la respuesta de `/record` de ORCID.

    Prioriza `credit-name` (el nombre tal y como el investigador prefiere mostrarlo);
    si no está disponible, compone `given-names` + `family-name`.
    """
    if not record:
        return None

    name = (record.get("person") or {}).get("name") or {}

    credit = name.get("credit-name")
    if isinstance(credit, dict):
        credit_value = credit.get("value")
        if credit_value:
            return credit_value

    given_obj = name.get("given-names")
    family_obj = name.get("family-name")
    given = given_obj.get("value") if isinstance(given_obj, dict) else None
    family = family_obj.get("value") if isinstance(family_obj, dict) else None

    full = " ".join(part for part in (given, family) if part)
    return full or None


def get_display_name(orcid_id: str) -> str | None:
    """
    Obtiene el nombre público del investigador desde ORCID.

    Devuelve `None` (sin propagar la excepción) si la API de ORCID no responde
    o el `record` no contiene un nombre utilizable, para no romper el flujo de
    búsqueda cuando solo falla la resolución del nombre.
    """
    try:
        record = get_record(orcid_id)
    except Exception:
        return None
    return extract_display_name(record)
