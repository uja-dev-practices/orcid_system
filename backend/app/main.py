from fastapi import FastAPI
from app.services.orcid_client import ORCIDClient

app = FastAPI()

@app.get("/orcid/{orcid_id}/works")
def test_works(orcid_id: str):
    client = ORCIDClient()
    return client.fetch_works(orcid_id)
