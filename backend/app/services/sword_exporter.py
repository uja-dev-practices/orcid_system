from datetime import datetime
from xml.etree.ElementTree import Element, SubElement, tostring
from io import BytesIO
import zipfile
import json


class SWORDExporter:

    ATOM_NS = "http://www.w3.org/2005/Atom"
    DC_NS = "http://purl.org/dc/elements/1.1/"

    # ---------------------------------------------------------
    # 1) XML PRINCIPAL (sword.xml)
    # ---------------------------------------------------------
    @staticmethod
    def export_feed_xml(researcher, publications) -> bytes:
        feed = Element("feed", xmlns=SWORDExporter.ATOM_NS)

        title = SubElement(feed, "title")
        title.text = f"Publications for {researcher.orcid_id}"

        author = SubElement(feed, "author")
        name = SubElement(author, "name")
        name.text = researcher.name or "Unknown"

        updated = SubElement(feed, "updated")
        updated.text = datetime.utcnow().isoformat() + "Z"

        feed_id = SubElement(feed, "id")
        feed_id.text = f"urn:uuid:{researcher.id}"

        for pub in publications:
            entry = SubElement(feed, "entry")

            entry_id = SubElement(entry, "id")
            entry_id.text = f"urn:uuid:{pub.id}"

            entry_updated = SubElement(entry, "updated")
            entry_updated.text = datetime.utcnow().isoformat() + "Z"

            dc_title = SubElement(entry, f"{{{SWORDExporter.DC_NS}}}title")
            dc_title.text = pub.title

            if pub.doi:
                dc_identifier = SubElement(entry, f"{{{SWORDExporter.DC_NS}}}identifier")
                dc_identifier.text = f"doi:{pub.doi}"

            if pub.pub_year:
                dc_date = SubElement(entry, f"{{{SWORDExporter.DC_NS}}}date")
                dc_date.text = str(pub.pub_year)

            if pub.type:
                dc_type = SubElement(entry, f"{{{SWORDExporter.DC_NS}}}type")
                dc_type.text = pub.type

            if pub.journal:
                dc_source = SubElement(entry, f"{{{SWORDExporter.DC_NS}}}source")
                dc_source.text = pub.journal

        xml_bytes = tostring(feed, encoding="utf-8", xml_declaration=True)
        return xml_bytes

    # ---------------------------------------------------------
    # 2) manifest.txt
    # ---------------------------------------------------------
    @staticmethod
    def generate_manifest(researcher, publications) -> str:
        lines = [
            "SWORD Deposit Package",
            "----------------------",
            f"Researcher ORCID: {researcher.orcid_id}",
            f"Researcher Name: {researcher.name or 'Unknown'}",
            f"Total Publications: {len(publications)}",
            f"Generated At: {datetime.utcnow().isoformat()}Z",
            "",
            "Publications:",
        ]

        for pub in publications:
            lines.append(f"- {pub.title} ({pub.pub_year}) DOI={pub.doi}")

        return "\n".join(lines)

    # ---------------------------------------------------------
    # 3) metadata.json
    # ---------------------------------------------------------
    @staticmethod
    def generate_metadata_json(researcher, publications) -> str:
        data = {
            "researcher": {
                "orcid_id": researcher.orcid_id,
                "name": researcher.name,
                "id": str(researcher.id),
            },
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "publications": [
                {
                    "id": str(pub.id),
                    "title": pub.title,
                    "doi": pub.doi,
                    "year": pub.pub_year,
                    "type": pub.type,
                    "journal": pub.journal,
                }
                for pub in publications
            ],
        }
        return json.dumps(data, indent=4)

    # ---------------------------------------------------------
    # 4) mets.xml (versión simple)
    # ---------------------------------------------------------
    @staticmethod
    def generate_mets_xml(researcher, publications) -> bytes:
        mets = Element("mets", xmlns="http://www.loc.gov/METS/")

        header = SubElement(mets, "metsHdr")
        agent = SubElement(header, "agent", ROLE="CREATOR", TYPE="OTHER")
        name = SubElement(agent, "name")
        name.text = "ORCID Exporter System"

        dmd_sec = SubElement(mets, "dmdSec", ID="dmd1")
        md_wrap = SubElement(dmd_sec, "mdWrap", MDTYPE="DC")
        xml_data = SubElement(md_wrap, "xmlData")

        for pub in publications:
            dc_title = SubElement(xml_data, f"{{{SWORDExporter.DC_NS}}}title")
            dc_title.text = pub.title

            if pub.doi:
                dc_id = SubElement(xml_data, f"{{{SWORDExporter.DC_NS}}}identifier")
                dc_id.text = f"doi:{pub.doi}"

        return tostring(mets, encoding="utf-8", xml_declaration=True)

    # ---------------------------------------------------------
    # 5) ZIP FINAL
    # ---------------------------------------------------------
    @staticmethod
    def export_zip(researcher, publications) -> bytes:
        xml_bytes = SWORDExporter.export_feed_xml(researcher, publications)
        manifest = SWORDExporter.generate_manifest(researcher, publications)
        metadata_json = SWORDExporter.generate_metadata_json(researcher, publications)
        mets_xml = SWORDExporter.generate_mets_xml(researcher, publications)

        mem_file = BytesIO()
        with zipfile.ZipFile(mem_file, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("sword.xml", xml_bytes)
            zf.writestr("manifest.txt", manifest)
            zf.writestr("metadata.json", metadata_json)
            zf.writestr("mets.xml", mets_xml)

        mem_file.seek(0)
        return mem_file.read()
