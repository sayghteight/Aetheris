use super::ExportManuscript;

pub fn generate(manuscript: &ExportManuscript) -> String {
    let mut md = String::new();

    // Title
    md.push_str("# ");
    md.push_str(&manuscript.title);
    md.push_str("\n\n");

    // Author
    if let Some(author) = &manuscript.author {
        md.push_str("*");
        md.push_str(author);
        md.push_str("*\n\n");
    }

    md.push_str("---\n\n");

    for (pi, part) in manuscript.parts.iter().enumerate() {
        if pi > 0 {
            md.push_str("\n---\n\n");
        }

        // Part title
        md.push_str("## ");
        md.push_str(&part.title);
        md.push_str("\n\n");

        for chapter in &part.chapters {
            // Chapter title
            md.push_str("### ");
            md.push_str(&chapter.title);
            md.push_str("\n\n");

            for scene in &chapter.scenes {
                // Scene title
                md.push_str("**");
                md.push_str(&scene.title);
                md.push_str("**\n\n");

                // Scene content — convertir HTML a texto plano
                let content = html_to_plain_text(&scene.content);
                md.push_str(&content);
                md.push_str("\n\n");
            }
        }
    }

    md
}

/// Convierte HTML de Tiptap a texto plano con párrafos separados por doble salto de línea
fn html_to_plain_text(html: &str) -> String {
    let normalized = html
        .replace("<br>", "\n")
        .replace("<br/>", "\n")
        .replace("<br />", "\n")
        .replace("</p>", "\n\n")
        .replace("<p>", "");

    // Limpiar cualquier etiqueta HTML restante
    let mut result = String::new();
    let mut in_tag = false;
    for ch in normalized.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => result.push(ch),
            _ => {}
        }
    }

    // Normalizar saltos de línea múltiples
    let mut lines: Vec<&str> = result.split('\n').collect();
    lines.retain(|l| !l.trim().is_empty());
    lines.join("\n\n")
}
