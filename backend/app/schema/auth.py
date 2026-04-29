from pydantic import BaseModel, Field


class OrcidLoginRequestSchema(BaseModel):
    # `code` is the authorization code returned by ORCID OAuth after the user signs in.
    # Exchanging it for tokens must happen server-side.
    code: str = Field(..., examples=["Q70Y3A"])


class OrcidLoginResponseSchema(BaseModel):
    access_token: str
    token_type: str = "bearer"
