from datetime import datetime
from xml.etree.ElementTree import Element, SubElement, tostring
from app.db.models import Publication, Researcher

ATOM_NS = "http://www.w3.org/2005/Atom"
DC_NS = "http://purl.org/dc/elements/1.1/"
EXTRA_NS = "http://example.org/orcid-extra"   # namespace para campos extendidos

# ---------------------------------------------------------
# Clase de generador de feed SWORD
# ---------------------------------------------------------

class SWORDGenerator:

    @staticmethod
    def generate_feed_xml(researcher: Researcher, publications: list[Publication]) -> bytes:
        feed = Element("feed", {
            "xmlns": ATOM_NS,
            "xmlns:dc": DC_NS,
            "xmlns:extra": EXTRA_NS
        })

        SubElement(feed, "title").text = f"Publications for {researcher.orcid_id}"

        author = SubElement(feed, "author")
        SubElement(author, "name").text = researcher.name or "Unknown"

        SubElement(feed, "updated").text = datetime.utcnow().isoformat() + "Z"
        SubElement(feed, "id").text = f"urn:uuid:{researcher.id}"

        for pub in publications:
            entry = SubElement(feed, "entry")

            SubElement(entry, "id").text = f"urn:uuid:{pub.id}"
            SubElement(entry, "updated").text = datetime.utcnow().isoformat() + "Z"

            # Title
            SubElement(entry, f"{{{DC_NS}}}title").text = pub.title or "Untitled"

            # Subtitle
            if pub.subtitle:
                SubElement(entry, f"{{{EXTRA_NS}}}subtitle").text = pub.subtitle

            # DOI
            if pub.doi:
                SubElement(entry, f"{{{DC_NS}}}identifier").text = f"doi:{pub.doi}"

            # Journal
            if pub.journal:
                SubElement(entry, f"{{{DC_NS}}}source").text = pub.journal

            # URL
            if pub.url:
                SubElement(entry, f"{{{DC_NS}}}relation").text = pub.url

            # Short description
            if pub.short_description:
                SubElement(entry, f"{{{DC_NS}}}description").text = pub.short_description

            # Citation
            if pub.citation_value:
                cit = SubElement(entry, f"{{{EXTRA_NS}}}citation")
                SubElement(cit, "type").text = pub.citation_type or "unknown"
                SubElement(cit, "value").text = pub.citation_value

            # Language
            if pub.language_code:
                SubElement(entry, f"{{{DC_NS}}}language").text = pub.language_code

            # Country
            if pub.country:
                SubElement(entry, f"{{{EXTRA_NS}}}country").text = pub.country

            # External IDs
            if pub.external_ids:
                ext_ids_el = SubElement(entry, f"{{{EXTRA_NS}}}external_ids")
                for ext in pub.external_ids:
                    ext_el = SubElement(ext_ids_el, "external_id")
                    for k, v in ext.items():
                        if isinstance(v, dict) and "value" in v:
                            SubElement(ext_el, k).text = v["value"]
                        else:
                            SubElement(ext_el, k).text = str(v)

            # Contributors
            if pub.contributors:
                contribs_el = SubElement(entry, f"{{{EXTRA_NS}}}contributors")
                for c in pub.contributors:
                    c_el = SubElement(contribs_el, "contributor")
                    SubElement(c_el, "name").text = c.get("name")
                    SubElement(c_el, "orcid").text = c.get("orcid")
                    SubElement(c_el, "role").text = c.get("role")

            # Date
            if pub.pub_year:
                date_str = str(pub.pub_year)
                if pub.pub_month:
                    date_str += f"-{pub.pub_month:02d}"
                if pub.pub_day:
                    date_str += f"-{pub.pub_day:02d}"
                SubElement(entry, f"{{{DC_NS}}}date").text = date_str

            # Type
            if pub.type:
                SubElement(entry, f"{{{DC_NS}}}type").text = pub.type

            # Status (new / updated / unchanged)
            if hasattr(pub, "status") and pub.status:
                SubElement(entry, f"{{{EXTRA_NS}}}status").text = pub.status

            # Last modified
            if pub.last_modified:
                SubElement(entry, f"{{{EXTRA_NS}}}last_modified").text = pub.last_modified.isoformat()

        return tostring(feed, encoding="utf-8", xml_declaration=True)
