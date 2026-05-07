import os
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader

# Cargar variables del .env
load_dotenv()

API_KEY_NAME = os.getenv("API_KEY_NAME")
API_KEY_VALUE = os.getenv("API_KEY_VALUE")

if not API_KEY_NAME:
    raise RuntimeError("ERROR: La variable API_KEY_NAME no está definida en el .env")

if not API_KEY_VALUE:
    raise RuntimeError("ERROR: La variable API_KEY_VALUE no está definida en el .env")

api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)


def get_api_key(api_key: str = Depends(api_key_header)):
    if api_key != API_KEY_VALUE:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key inválida o ausente."
        )
    return api_key


def get_api_key_optional(api_key: str = Depends(api_key_header)) -> str | None:
    """
    Devuelve la API key si está presente y es correcta.
    - Si no está presente: None
    - Si está presente pero incorrecta: 401
    """
    if api_key is None:
        return None
    if api_key != API_KEY_VALUE:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key inválida."
        )
    return api_key
