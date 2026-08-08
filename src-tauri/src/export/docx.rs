use super::ExportManuscript;
use std::io::Write;
use zip::ZipWriter;
use zip::write::SimpleFileOptions;

pub fn generate(manuscript: &ExportManuscript) -> Vec<u8> {
    let mut buffer = Vec::new();
    let mut zip = ZipWriter::new(std::io::Cursor::new(&mut buffer));

    let options: SimpleFileOptions = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // [Content_Types].xml
    zip.start_file("[Content_Types].xml", options).unwrap();
    zip.write_all(CONTENT_TYPES.as_bytes()).unwrap();

    // _rels/.rels
    zip.start_file("_rels/.rels", options).unwrap();
    zip.write_all(RELS.as_bytes()).unwrap();

    // word/_rels/document.xml.rels
    zip.start_file("word/_rels/document.xml.rels", options).unwrap();
    zip.write_all(DOC_RELS.as_bytes()).unwrap();

    // word/document.xml
    zip.start_file("word/document.xml", options).unwrap();
    let doc_xml = build_document_xml(manuscript);
    zip.write_all(doc_xml.as_bytes()).unwrap();

    // word/styles.xml
    zip.start_file("word/styles.xml", options).unwrap();
    zip.write_all(STYLES.as_bytes()).unwrap();

    // word/settings.xml
    zip.start_file("word/settings.xml", options).unwrap();
    zip.write_all(SETTINGS.as_bytes()).unwrap();

    zip.finish().unwrap();
    buffer
}

fn build_document_xml(manuscript: &ExportManuscript) -> String {
    let mut xml = String::new();
    xml.push_str(r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>"#);

    // Title
    xml.push_str(r#"<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr>"#);
    xml.push_str(&format_run(&manuscript.title, "Title", true));
    xml.push_str("</w:p>");

    // Author
    if let Some(author) = &manuscript.author {
        xml.push_str(r#"<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="480"/></w:pPr>"#);
        xml.push_str(&format_run(author, "Author", false));
        xml.push_str("</w:p>");
    }

    for (pi, part) in manuscript.parts.iter().enumerate() {
        if pi > 0 {
            xml.push_str(r#"<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr><w:spacing w:before="480" w:after="480"/></w:pPr></w:p>"#);
        }

        // Part heading
        xml.push_str(&create_heading(&part.title, 1));

        for chapter in &part.chapters {
            // Chapter heading
            xml.push_str(&create_heading(&chapter.title, 2));

            for scene in &chapter.scenes {
                // Scene title
                xml.push_str(&create_scene_title(&scene.title));

                // Scene content
                xml.push_str(&format_paragraphs(&scene.content));
            }
        }
    }

    xml.push_str("</w:body></w:document>");
    xml
}

fn create_heading(text: &str, level: u32) -> String {
    let style = match level {
        1 => "Heading1",
        2 => "Heading2",
        _ => "Normal",
    };
    let spacing = if level == 1 { r#"<w:spacing w:before="480" w:after="240"/>"# } else { r#""# };

    format!(
        r#"<w:p><w:pPr><w:pStyle w:val="{}"/><w:spacing w:before="360" w:after="120"/>{}</w:pPr>{}</w:p>"#,
        style,
        spacing,
        format_run(text, style, true)
    )
}

fn create_scene_title(text: &str) -> String {
    format!(
        r#"<w:p><w:pPr><w:spacing w:before="240" w:after="60"/></w:pPr>{}</w:p>"#,
        format_run(text, "SceneTitle", true)
    )
}

fn format_paragraphs(content: &str) -> String {
    // Convertir <br> de HTML en saltos de línea, luego separar
    let normalized = content
        .replace("<br>", "\n")
        .replace("<br/>", "\n")
        .replace("<br />", "\n");
    let paragraphs: Vec<&str> = normalized.split("\n\n").filter(|p| !p.trim().is_empty()).collect();
    let mut xml = String::new();

    for (i, para) in paragraphs.iter().enumerate() {
        let indent = if i > 0 { r#"<w:ind w:firstLine="720"/>"# } else { "" };
        xml.push_str(&format!(
            r#"<w:p><w:pPr><w:spacing w:after="120"/>{}</w:pPr>{}</w:p>"#,
            indent,
            format_text_run(para.trim())
        ));
    }

    xml
}

fn format_run(text: &str, style: &str, bold: bool) -> String {
    let bold_tag = if bold { r#"<w:b/><w:bCs/>"# } else { "" };
    format!(
        r#"<w:r><w:rPr><w:rStyle w:val="{}"/>{}</w:rPr><w:t xml:space="preserve">{}</w:t></w:r>"#,
        style,
        bold_tag,
        escape_xml(text)
    )
}

fn format_text_run(text: &str) -> String {
    format!(
        r#"<w:r><w:rPr><w:rStyle w:val="BodyText"/></w:rPr><w:t xml:space="preserve">{}</w:t></w:r>"#,
        escape_xml(text)
    )
}

fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

const CONTENT_TYPES: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>"#;

const RELS: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"#;

const DOC_RELS: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>"#;

const STYLES: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:style w:type="paragraph" w:styleId="Normal">
<w:name w:val="Normal"/>
<w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Title">
<w:name w:val="Title"/>
<w:basedOn w:val="Normal"/>
<w:pPr><w:jc w:val="center"/></w:pPr>
<w:rPr><w:b/><w:sz w:val="56"/><w:szCs w:val="56"/></w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Author">
<w:name w:val="Author"/>
<w:basedOn w:val="Normal"/>
<w:pPr><w:jc w:val="center"/></w:pPr>
<w:rPr><w:i/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Heading1">
<w:name w:val="Heading 1"/>
<w:basedOn w:val="Normal"/>
<w:pPr><w:keepNext/><w:spacing w:before="480" w:after="240"/></w:pPr>
<w:rPr><w:b/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Heading2">
<w:name w:val="Heading 2"/>
<w:basedOn w:val="Normal"/>
<w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120"/></w:pPr>
<w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="SceneTitle">
<w:name w:val="Scene Title"/>
<w:basedOn w:val="Normal"/>
<w:pPr><w:spacing w:before="240" w:after="60"/></w:pPr>
<w:rPr><w:b/><w:i/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="BodyText">
<w:name w:val="Body Text"/>
<w:basedOn w:val="Normal"/>
<w:pPr><w:spacing w:after="120"/></w:pPr>
<w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
</w:style>
</w:styles>"#;

const SETTINGS: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:defaultTabStop w:val="720"/>
</w:settings>"#;
