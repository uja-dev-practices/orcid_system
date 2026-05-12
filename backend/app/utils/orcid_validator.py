import re

ORCID_REGEX = re.compile(r"^\d{4}-\d{4}-\d{4}-\d{3}[0-9X]$")

ORCID_PATTERN = r"^\d{4}-\d{4}-\d{4}-\d{3}[0-9X]$"


def is_valid_orcid(orcid_id: str | None) -> bool:
    """
    Valida un ORCID ID:
    - Formato: 0000-0000-0000-0000
    - Dígito de control según ISO 7064 Mod 11-2
    """
    if not isinstance(orcid_id, str):
        return False
    if not ORCID_REGEX.match(orcid_id):
        return False

    digits = orcid_id.replace("-", "")

    total = 0
    for char in digits[:-1]:
        total = (total + int(char)) * 2

    remainder = total % 11
    result = (12 - remainder) % 11
    check_digit = "X" if result == 10 else str(result)

    return digits[-1] == check_digit


def assert_valid_orcid(orcid_id: str) -> str:
    """
    Devuelve el ORCID si es válido. Lanza ValueError si no.
    Útil para usar como Pydantic validator.
    """
    if not is_valid_orcid(orcid_id):
        raise ValueError("ORCID iD inválido")
    return orcid_id
